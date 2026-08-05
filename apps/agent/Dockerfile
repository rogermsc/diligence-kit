FROM python:3.12-slim

# LibreOffice for DOCX → PDF conversion (requires JRE + fonts)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice-writer \
        default-jre-headless \
        fontconfig \
        fonts-dejavu-core \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN groupadd -r agent && useradd -r -g agent agent && \
    chown -R agent:agent /app
USER agent

EXPOSE 8000

CMD ["python", "-m", "src.main"]
