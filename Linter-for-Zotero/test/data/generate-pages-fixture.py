"""Create the deterministic PDF used by the real Zotero indexing regression."""
from pathlib import Path
from reportlab.pdfgen import canvas

destination = Path(__file__).with_name("pages-three.pdf")
document = canvas.Canvas(str(destination), pagesize=(595, 842), invariant=1)
document.setTitle("Linter PDF regression fixture")
document.setAuthor("Linter for Zotero tests")
for page in range(1, 4):
    document.setFont("Helvetica-Bold", 20)
    document.drawString(54, 770, "Linter PDF regression fixture")
    document.setFont("Helvetica", 12)
    document.drawString(54, 730, f"Page {page} of 3")
    document.drawString(54, 704, "This document contains synthetic test data only.")
    document.showPage()
document.save()
