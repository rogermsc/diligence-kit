"""Which LibreOffice binary this machine has.

Two places shell out to LibreOffice — converting an uploaded .docx or .pptx to a
PDF for the model to read, and converting a rendered report back out — and they
disagreed. The renderer resolved the name; the extractor hardcoded
"libreoffice", which is what Debian installs and macOS does not. So a .docx
upload worked in the container and failed on a laptop, while the report it would
have produced converted fine.

One answer, imported by both, so fixing it in the place you happen to be looking
at cannot leave the other one wrong.
"""

import shutil


def binary() -> str:
    """`soffice` where it exists, `libreoffice` otherwise.

    Homebrew installs `soffice` only; Debian's libreoffice-writer provides both.
    Falling back to the Debian name rather than raising keeps the existing
    "conversion failed" errors, which say more than a missing-binary traceback.
    """
    return "soffice" if shutil.which("soffice") else "libreoffice"
