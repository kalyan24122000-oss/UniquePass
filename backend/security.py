import hashlib
import math

def hash_password(password: str) -> str:
    """
    Generates a SHA-256 fingerprint for the password to store in the database.
    Since this is for global uniqueness (and not authentication login passwords),
    a standard fast cryptographic hash without a salt is appropriate.
    """
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def calculate_strength(password: str, use_upper: bool, use_lower: bool, use_numbers: bool, use_symbols: bool, symbol_set: str) -> str:
    """
    Calculates an approximate password strength classification based on length and entropy.
    """
    pool_size = 0
    if use_upper: pool_size += 26
    if use_lower: pool_size += 26
    if use_numbers: pool_size += 10
    if use_symbols: pool_size += len(set(symbol_set))

    if pool_size == 0 or len(password) == 0:
        return "Weak"

    # Calculate Shannon entropy
    entropy = len(password) * math.log2(pool_size)

    if entropy < 40:
        return "Weak"
    elif entropy < 60:
        return "Moderate"
    elif entropy < 80:
        return "Strong"
    else:
        return "Very Strong"
