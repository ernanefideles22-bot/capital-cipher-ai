import logging


def configure_log_output(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s capital_cipher_backend %(message)s",
        force=True,
    )
