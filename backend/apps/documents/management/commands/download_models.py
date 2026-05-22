import time

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Pre-download Docling layout/table models and the HuggingFace tokenizer. "
        "Run once per environment before processing documents."
    )

    def handle(self, *args, **options):
        self.stdout.write("Downloading Docling models and tokenizer...\n")
        start = time.time()

        self.stdout.write("  [1/3] Initializing DocumentConverter (layout + table models)...")
        from core.rag.chunking import get_converter
        get_converter()
        self.stdout.write(self.style.SUCCESS(" OK"))

        self.stdout.write("  [2/3] Initializing HybridChunker (tokenizer)...")
        from core.rag.chunking import get_chunker
        get_chunker()
        self.stdout.write(self.style.SUCCESS(" OK"))

        self.stdout.write("  [3/3] Verifying embedding service...")
        from core.rag.embeddings import EmbeddingService
        EmbeddingService()
        self.stdout.write(self.style.SUCCESS(" OK"))

        elapsed = time.time() - start
        self.stdout.write(
            self.style.SUCCESS(f"\nAll models ready ({elapsed:.1f}s).")
        )
