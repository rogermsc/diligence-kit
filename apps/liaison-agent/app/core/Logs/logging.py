import logging
import sys

from app.core.config.settings import settings


def setup_logging():
    """
    Configure the application's logging system.
    """
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    logger = logging.getLogger("Diligence Kit Liaison")
    logger.info(f"Logging configured. Level: {settings.LOG_LEVEL}")
    return logger

logger = setup_logging()