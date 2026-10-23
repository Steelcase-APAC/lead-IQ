# CRE Lease-IQ - Google Cloud Run Container
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output for Cloud Run logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Copy application files (see .dockerignore for exclusions)
COPY . /app

# Expose default Cloud Run port
EXPOSE 8080

# Start server
CMD ["python", "server.py"]
