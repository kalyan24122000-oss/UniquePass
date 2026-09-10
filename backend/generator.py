import secrets
import string

def generate_password(length: int, use_upper: bool, use_lower: bool, use_numbers: bool, use_symbols: bool, symbol_set: str, require_each: bool) -> str:
    """
    Generates a cryptographically secure random password based on specified criteria.
    Uses Python's secrets module to ensure security and prevent modulo bias.
    """
    pool = ""
    if use_upper: pool += string.ascii_uppercase
    if use_lower: pool += string.ascii_lowercase
    if use_numbers: pool += string.digits
    if use_symbols: pool += symbol_set

    if not pool:
        raise ValueError("At least one character category must be selected")

    password_chars = []

    # Enforce at least one character from each selected category
    if require_each:
        if use_upper: password_chars.append(secrets.choice(string.ascii_uppercase))
        if use_lower: password_chars.append(secrets.choice(string.ascii_lowercase))
        if use_numbers: password_chars.append(secrets.choice(string.digits))
        if use_symbols:
            if not symbol_set:
                raise ValueError("Symbol set cannot be empty if symbols are required")
            password_chars.append(secrets.choice(symbol_set))

    remaining_length = length - len(password_chars)
    if remaining_length < 0:
        raise ValueError("Length is too short to require all selected categories")

    # Fill the rest of the password length
    for _ in range(remaining_length):
        password_chars.append(secrets.choice(pool))

    # Securely shuffle the characters to avoid predictable patterns 
    # (e.g. required characters always appearing at the beginning)
    secrets.SystemRandom().shuffle(password_chars)

    return "".join(password_chars)
