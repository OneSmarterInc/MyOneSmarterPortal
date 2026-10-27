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
from pyhanko.sign import signers
from pyhanko_certvalidator.registry import SimpleCertificateStore


class LetterSigningError(Exception):
    pass


def sign_letter(pdf):
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
        output = signers.sign_pdf(
            IncrementalPdfFileWriter(BytesIO(pdf)),
            signers.PdfSignatureMetadata(
                field_name='OneSmarterApproval', md_algorithm='sha256',
                reason='Approved recommendation letter',
                contact_info='akshay.kumar@onesmarter.com',
            ), signer=signer,
        )
        return output.getvalue()
    except Exception:
        raise LetterSigningError('The PDF could not be digitally signed. No email was sent. Contact the server administrator.') from None
