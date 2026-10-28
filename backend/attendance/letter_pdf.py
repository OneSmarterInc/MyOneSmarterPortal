"""Render the saved letter snapshot; never interpolate user text as PDF markup."""
from io import BytesIO
from pathlib import Path
import os
import json
import base64
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign.fields import append_signature_field, SigFieldSpec
from pyhanko.pdf_utils.generic import pdf_name, pdf_string

CONTACT = 'akshay.kumar@onesmarter.com'
SIGNATORY = 'Akshay Agrawal'
TITLE = 'Global Delivery Manager'
SIGNATURE_FIELD = 'OneSmarterApproval'
SIGNATURE_WIDTH, SIGNATURE_HEIGHT = 220, 118


def draw_signature_box(c, signer=None, signed_at=None, verification_id=''):
    """Word-style signature line; the signed appearance replaces the preview."""
    normal, _ = fonts()
    c.setFillColor(HexColor('#ffffff'))
    c.rect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT, stroke=0, fill=1)
    c.setStrokeColor(HexColor('#8c6e36')); c.setLineWidth(.6)
    c.rect(7, 99, 7, 9, fill=0, stroke=1)
    c.line(9, 105, 12, 105); c.line(9, 102, 12, 102)
    c.setFillColor(HexColor('#c7192d')); c.setFont(normal, 8)
    c.drawString(22, 101, 'Digitally signed' if signed_at else 'Awaiting approval')
    c.setFillColor(HexColor('#111111')); c.setFont(normal, 24)
    c.drawString(4, 72, 'X')
    c.setFont(normal, 14); c.drawString(27, 74, SIGNATORY)
    c.setStrokeColor(HexColor('#111111')); c.setLineWidth(.8)
    c.line(0, 68, SIGNATURE_WIDTH, 68)
    c.setFont(normal, 9); c.drawString(8, 55, SIGNATORY)
    c.drawString(8, 42, TITLE)
    c.setFont(normal, 8)
    label = 'Signed by: ' + (signer or SIGNATORY)
    # Fit certificate names without overflowing the signature box.
    size = min(8, 8 * (SIGNATURE_WIDTH - 16) / max(c.stringWidth(label, normal, 8), 1))
    c.setFont(normal, size); c.drawString(8, 29, label)
    c.setFont(normal, 7)
    c.drawString(8, 16, 'Verification ID: ' + verification_id)
    c.setFont(normal, 7)
    c.drawString(8, 3, signed_at or 'Signature and signing date are added after approval.')


def signature_artwork(signer, signed_at, verification_id):
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=(SIGNATURE_WIDTH, SIGNATURE_HEIGHT))
    draw_signature_box(c, signer, signed_at, verification_id)
    c.save()
    return stream.getvalue()


def fonts():
    regular = os.environ.get('LOR_FONT_REGULAR', 'C:/Windows/Fonts/times.ttf')
    bold = os.environ.get('LOR_FONT_BOLD', 'C:/Windows/Fonts/timesbd.ttf')
    if Path(regular).is_file() and Path(bold).is_file():
        if 'LetterTimes' not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont('LetterTimes', regular))
            pdfmetrics.registerFont(TTFont('LetterTimes-Bold', bold))
            pdfmetrics.registerFontFamily('LetterTimes', normal='LetterTimes', bold='LetterTimes-Bold')
        return 'LetterTimes', 'LetterTimes-Bold'
    return 'Times-Roman', 'Times-Bold'


def render_letter(data):
    normal, bold = fonts()
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=(612, 792))
    c.setTitle('Letter of Recommendation - ' + data['name'])
    style = ParagraphStyle('Letter', fontName=normal, fontSize=11, leading=16)
    page = 0

    def header():
        nonlocal page
        page += 1
        artwork = json.loads(Path(__file__).with_name('letterhead.json').read_text())['png']
        c.drawImage(ImageReader(BytesIO(base64.b64decode(artwork))), 0, 713, width=612, height=79)
        c.setFillColor(HexColor('#c7192d')); c.rect(0, 0, 612, 14, fill=1, stroke=0)
        c.setFillColor(HexColor('#ffffff')); c.setFont(normal, 8); c.drawCentredString(306, 4, 'www.onesmarter.com')
        c.setFillColor(HexColor('#222222')); c.setFont(bold, 17)
        c.drawCentredString(306, 679, 'LETTER OF RECOMMENDATION')
        c.setFillColor(HexColor('#c7192d')); c.rect(266, 664, 80, 2, fill=1, stroke=0)
        c.setFillColor(HexColor('#777777')); c.setFont(normal, 8); c.drawRightString(544, 28, str(page))

    header()
    y = 640

    def paragraph(text, gap=12):
        nonlocal y
        item = Paragraph(text, style)
        _, height = item.wrap(476, 700)
        if y - height < 70:
            c.showPage(); header(); y = 640
        item.drawOn(c, 68, y - height)
        y -= height + gap

    d = {key: escape(str(value)) for key, value in data.items()}
    paragraph(f"<b>Date:</b> {d['issue_date']}", 18)
    paragraph('<b>To Whom It May Concern,</b>', 18)
    period = f"from {d['start_date']} to {d['end_date']}" if data.get('end_date') else f"since {d['start_date']} and continues in this role as of the date of this letter"
    paragraph(f"I am pleased to recommend <b>{d['name']}</b>, who {'worked' if data.get('end_date') else 'has been working'} with <b>One Smarter, Inc.</b> as <b>{d['designation']}</b> in {d['department']} {period}. In my capacity as {TITLE}, I have had the opportunity to review their work and contributions.")
    paragraph(f"During this period, {d['name']} contributed to {d['responsibilities']}. A notable contribution was {d['achievement']}, demonstrating {d['capability']}.")
    paragraph(f"{d['name']} demonstrated {d['strengths']}. For example, {d['example']}.")
    paragraph(f"Based on their contributions, I recommend {d['name']} for {d['recommendation_purpose']}. {d['endorsement']}")
    paragraph(f'Please contact me at <b>{CONTACT}</b> if you require any additional information.', 18)
    # Reserve the full sign-off so the visible signature never covers letter text.
    if y - (SIGNATURE_HEIGHT + 36) < 70:
        c.showPage(); header(); y = 640
    paragraph('Sincerely,', 16)
    signature_bottom = y - SIGNATURE_HEIGHT
    c.saveState(); c.translate(68, signature_bottom)
    draw_signature_box(c, verification_id=data.get('verification_id', ''))
    c.restoreState()
    c.save()
    writer = IncrementalPdfFileWriter(BytesIO(stream.getvalue()))
    writer.root[pdf_name('/OneSmarterVerificationID')] = pdf_string(data.get('verification_id', ''))
    writer.update_root()
    append_signature_field(writer, SigFieldSpec(
        sig_field_name=SIGNATURE_FIELD, on_page=page - 1,
        box=(68, signature_bottom, 68 + SIGNATURE_WIDTH, y),
        readable_field_name='OneSmarter manager approval',
    ))
    output = BytesIO()
    writer.write(output)
    return output.getvalue()
