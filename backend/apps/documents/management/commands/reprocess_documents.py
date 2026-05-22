import logging
import time

from django.core.management.base import BaseCommand, CommandError

from apps.documents.models import Document
from apps.documents.tasks import process_document_task

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Re-process documents through the Docling pipeline. "
        "Use after upgrading the chunking strategy to rebuild all vectors."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--collection",
            type=str,
            help="Only reprocess documents in this collection (UUID).",
        )
        parser.add_argument(
            "--document",
            type=str,
            help="Reprocess a single document (UUID).",
        )
        parser.add_argument(
            "--status",
            type=str,
            choices=["ready", "failed", "all"],
            default="all",
            help="Which documents to reprocess by current status (default: all).",
        )
        parser.add_argument(
            "--sync",
            action="store_true",
            help="Process synchronously instead of queuing to Celery.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which documents would be reprocessed without doing it.",
        )

    def handle(self, *args, **options):
        queryset = Document.objects.exclude(status=Document.Status.PROCESSING)

        if options["document"]:
            queryset = queryset.filter(id=options["document"])
        elif options["collection"]:
            queryset = queryset.filter(collection_id=options["collection"])

        if options["status"] == "ready":
            queryset = queryset.filter(status=Document.Status.READY)
        elif options["status"] == "failed":
            queryset = queryset.filter(status=Document.Status.FAILED)

        documents = list(queryset.order_by("uploaded_at"))

        if not documents:
            self.stdout.write(self.style.WARNING("No documents found matching criteria."))
            return

        self.stdout.write(f"Found {len(documents)} document(s) to reprocess:\n")
        for doc in documents:
            self.stdout.write(
                f"  [{doc.status}] {doc.title} "
                f"(collection={doc.collection.name}, pages={doc.page_count})"
            )

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("\nDry run — no changes made."))
            return

        self.stdout.write("")
        succeeded = 0
        failed = 0

        for i, doc in enumerate(documents, 1):
            self.stdout.write(
                f"[{i}/{len(documents)}] Processing: {doc.title}...",
                ending=" ",
            )

            if options["sync"]:
                start = time.time()
                try:
                    from apps.documents.services.ingestion import (
                        IngestionError,
                        IngestionService,
                    )

                    service = IngestionService()
                    service.process_document(str(doc.id))
                    elapsed = time.time() - start
                    self.stdout.write(self.style.SUCCESS(f"OK ({elapsed:.1f}s)"))
                    succeeded += 1
                except IngestionError as e:
                    elapsed = time.time() - start
                    self.stdout.write(self.style.ERROR(f"FAILED ({elapsed:.1f}s): {e}"))
                    failed += 1
            else:
                process_document_task.delay(str(doc.id))
                self.stdout.write(self.style.SUCCESS("queued"))
                succeeded += 1

        self.stdout.write(
            f"\nDone. {succeeded} {'queued' if not options['sync'] else 'succeeded'}, "
            f"{failed} failed."
        )
