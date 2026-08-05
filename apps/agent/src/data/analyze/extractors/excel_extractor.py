import os
from typing import List, Tuple

import pandas as pd

from src.core.logging import get_logger

logger = get_logger(__name__)

_MAX_EXCEL_BYTES = 50 * 1024 * 1024  # 50 MB


def extract_sheets(file_path: str) -> List[Tuple[str, str]]:
    """Extract all sheets from an Excel file as (sheet_name, csv_text) pairs."""
    size = os.path.getsize(file_path)
    if size > _MAX_EXCEL_BYTES:
        raise ValueError(f"Excel file too large: {size} bytes (max {_MAX_EXCEL_BYTES})")

    sheets = pd.read_excel(file_path, sheet_name=None, dtype=str)

    results = []
    for sheet_name, df in sheets.items():
        if df.empty:
            logger.info(f"Sheet '{sheet_name}': empty, skipping")
            continue

        csv_text = df.to_csv(index=False)
        results.append((sheet_name, csv_text))
        logger.info(f"Sheet '{sheet_name}': {len(df)} rows, {len(df.columns)} cols")

    logger.info(f"Excel extraction: {len(results)} sheets")
    return results
