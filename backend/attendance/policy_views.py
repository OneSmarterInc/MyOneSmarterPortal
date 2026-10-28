import os
import re
from hashlib import sha256
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, BadZipFile

from django.http import HttpResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .letter_auth import LetterAuthentication

DEFAULT_ARCHIVE = '/var/www/private_media/onesmarter-policies/policies.zip'
DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def document_entries(archive):
    entries = []
    for info in archive.infolist():
        path = PurePosixPath(info.filename)
        if info.is_dir() or path.suffix.lower() != '.docx' or '__MACOSX' in path.parts or path.name.startswith('~$'):
            continue
        title = re.sub(r'^One Smarter-', '', path.stem)
        title = re.sub(r'-(?:V1dot|[0-9]+(?:\.[0-9]+)*)$', '', title)
        entries.append({'id': sha256(info.filename.encode()).hexdigest()[:24],
                        'title': title, 'type': 'Policy' if 'Policies' in path.parts else 'Procedure',
                        'filename': path.name, 'size': info.file_size, '_entry': info.filename})
    return sorted(entries, key=lambda item: (item['type'] != 'Policy', item['title'].lower()))


@api_view(['GET'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def policy_documents(request):
    # The originals live outside the public repository and web root.
    path = Path(os.environ.get('OSI_PRIVATE_POLICIES_ZIP', DEFAULT_ARCHIVE))
    try:
        with ZipFile(path) as archive:
            entries = document_entries(archive)
            document_id = request.query_params.get('id')
            if document_id:
                doc = next((item for item in entries if item['id'] == document_id), None)
                if doc is None:
                    return Response({'error': 'Document not found.'}, status=404)
                # Only archive entries from the server-built allowlist can be read.
                response = HttpResponse(archive.read(doc['_entry']), content_type=DOCX_TYPE)
                from django.utils.http import content_disposition_header
                response['Content-Disposition'] = content_disposition_header(True, doc['filename'])
                response['X-Content-Type-Options'] = 'nosniff'
            else:
                response = Response([{k: v for k, v in doc.items() if k != '_entry'} for doc in entries])
    except (OSError, BadZipFile, RuntimeError):
        return Response({'error': 'Policy documents are temporarily unavailable. Please contact your administrator.'}, status=503)
    response['Cache-Control'] = 'private, no-store'
    return response
