"""
ZeroClaw Package - ZeroClaw gateway and adapters
"""

from .adapters import (
    BaseAdapter,
    ZeroClawGateway,
    GitAdapter,
    ShellAdapter,
    FilesystemAdapter,
    ResearchAdapter,
)

__all__ = [
    "BaseAdapter",
    "ZeroClawGateway",
    "GitAdapter",
    "ShellAdapter",
    "FilesystemAdapter",
    "ResearchAdapter",
]
