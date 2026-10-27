import json
import os
from pathlib import Path

from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .letter_auth import LetterAuthentication


def _private_documents():
    configured = os.environ.get('OSI_PRIVATE_POLICIES_JSON', '')
    if not configured:
        return None
    path = Path(configured)
    if not path.is_file():
        return None
    with path.open('r', encoding='utf-8') as stream:
        return json.load(stream)


@api_view(['GET'])
@authentication_classes([LetterAuthentication])
@permission_classes([IsAuthenticated])
def policy_documents(request):
    try:
        docs = _private_documents()
    except (OSError, ValueError, json.JSONDecodeError):
        return Response({'error': 'Unable to read internal policies.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if docs is None:
        return Response({'error': 'Internal policy files have not been installed on this server.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if request.query_params.get('id'):
        doc = next((d for d in docs if d.get('id') == request.query_params['id']), None)
        if doc is None:
            return Response({'error': 'Policy not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(doc)
    return Response([{'id': d['id'], 'title': d['title'], 'type': d['type'], 'sections': len(d.get('blocks', []))} for d in docs])
