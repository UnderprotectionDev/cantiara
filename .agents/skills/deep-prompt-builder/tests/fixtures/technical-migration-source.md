# Technical Migration Source

Legacy record identifiers are stored as strings. Some identifiers contain only digits and
retain leading zeroes. References in exported archives use the original identifier text.

The migration must preserve record identity and can be resumed after interruption. The
source does not choose a target representation or migration mechanism.
