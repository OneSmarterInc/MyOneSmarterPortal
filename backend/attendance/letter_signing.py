"""Sign approved PDFs using server-only PKCS#12 credentials."""
import os
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PrivateFormat, NoEncryption
from asn1crypto.keys import PrivateKeyInfo
from asn1crypto.x509 import Certificate
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.pdf_utils.content import PdfContent
from pyhanko.pdf_utils.layout import BoxConstraints, SimpleBoxLayoutRule, AxisAlignment, Margins
from pyhanko.sign import signers
from pyhanko.sign.fields import enumerate_sig_fields
from pyhanko.sign.validation import validate_pdf_signature, SignatureCoverageLevel
from pyhanko.stamp import StaticStampStyle
from pyhanko_certvalidator import ValidationContext
from pyhanko_certvalidator.registry import SimpleCertificateStore
from zoneinfo import ZoneInfo
from .letter_pdf import signature_artwork, SIGNATURE_FIELD, SIGNATURE_WIDTH, SIGNATURE_HEIGHT


class LetterSigningError(Exception):
    pass


class SignatureArtwork(PdfContent):
    def __init__(self, artwork):
        super().__init__(box=BoxConstraints(width=SIGNATURE_WIDTH, height=SIGNATURE_HEIGHT))
        self.artwork = artwork

    def render(self):
        reader = PdfFileReader(BytesIO(self.artwork))
        self.resources.xobject['/SignatureArtwork'] = self._ensure_writer.import_page_as_xobject(reader, page_ix=0)
        return b'/SignatureArtwork Do'


def verify_signed_letter(pdf):
    """Fail closed before attaching: verify integrity, not public identity trust."""
    try:
        signatures = PdfFileReader(BytesIO(pdf)).embedded_signatures
        if len(signatures) != 1 or signatures[0].field_name != SIGNATURE_FIELD:
            raise ValueError('Missing approval signature')
        signature = signatures[0]
        x1, y1, x2, y2 = signature.sig_field['/Rect']
        if x2 <= x1 or y2 <= y1:
            raise ValueError('No visible signature; save a new preview')
        result = validate_pdf_signature(signature, signer_validation_context=ValidationContext(
            trust_roots=[signature.signer_cert], allow_fetching=False))
        if not (result.intact and result.valid and result.coverage == SignatureCoverageLevel.ENTIRE_FILE):
            raise ValueError('Invalid or modified signature')
    except Exception:
        raise LetterSigningError('The signed PDF could not be verified. Save and preview the letter again before approving. No email was sent.') from None


def sign_letter(pdf):
    try:
        reader = PdfFileReader(BytesIO(pdf))
        has_field = any(name == SIGNATURE_FIELD and value is None for name, value, ref in enumerate_sig_fields(reader))
    except Exception:
        has_field = False
    if not has_field:
        raise LetterSigningError('Save and preview this letter again to add the visible signature box before approving. No email was sent.')
    certificate_path = os.environ.get('LOR_SIGNING_P12_PATH')
    password_path = os.environ.get('LOR_SIGNING_PASSWORD_FILE')
    if not certificate_path or not password_path:
        raise LetterSigningError('Letter signing is not configured. Ask the server administrator to configure the certificate and password file. No email was sent.')
    try:
        password = Path(password_path).read_bytes().rstrip(b'\r\n')
        if not password:
            raise ValueError('Empty password')
        certificate_data = Path(certificate_path).read_bytes()
        key, certificate, chain = pkcs12.load_key_and_certificates(certificate_data, password)
        if key is None or certificate is None:
            raise ValueError('Missing key or certificate')
    except Exception:
        raise LetterSigningError('The signing certificate or password could not be loaded. Check the server signing configuration. No email was sent.') from None

    now = datetime.now(timezone.utc)
    if not certificate.not_valid_before_utc <= now <= certificate.not_valid_after_utc:
        raise LetterSigningError('The signing certificate is expired or not yet valid. Renew or correct it before sending. No email was sent.')
    try:
        usage = certificate.extensions.get_extension_for_class(x509.KeyUsage).value
        if not (usage.digital_signature or usage.content_commitment):
            raise LetterSigningError('The certificate does not permit document signing. No email was sent.')
    except x509.ExtensionNotFound:
        pass

    try:
        registry = SimpleCertificateStore()
        registry.register_multiple(Certificate.load(cert.public_bytes(Encoding.DER)) for cert in chain or [])
        signer = signers.SimpleSigner(
            signing_key=PrivateKeyInfo.load(key.private_bytes(Encoding.DER, PrivateFormat.PKCS8, NoEncryption())),
            signing_cert=Certificate.load(certificate.public_bytes(Encoding.DER)),
            cert_registry=registry,
        )
        names = certificate.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
        signer_name = names[0].value if names else certificate.subject.rfc4514_string()
        signed_at = now.astimezone(ZoneInfo('Asia/Kolkata')).strftime('%d %b %Y, %I:%M %p IST')
        appearance = StaticStampStyle(
            border_width=0, background=SignatureArtwork(signature_artwork(signer_name, signed_at)),
            background_layout=SimpleBoxLayoutRule(
                x_align=AxisAlignment.ALIGN_MIN, y_align=AxisAlignment.ALIGN_MIN, margins=Margins.uniform(0)),
        )
        output = signers.PdfSigner(
            signers.PdfSignatureMetadata(
                field_name=SIGNATURE_FIELD, md_algorithm='sha256',
                reason='Approved recommendation letter',
                contact_info='akshay.kumar@onesmarter.com',
            ), signer=signer, stamp_style=appearance,
        ).sign_pdf(IncrementalPdfFileWriter(BytesIO(pdf)), existing_fields_only=True)
        return output.getvalue()
    except Exception:
        raise LetterSigningError('The PDF could not be digitally signed. No email was sent. Contact the server administrator.') from None
