import pypdf

with open("giannakopulos.pdf", "rb") as file:
    reader = pypdf.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"

with open("giannakopulos.txt", "w", encoding="utf-8") as file:
    file.write(text)
