"""
Generate a secure JWT secret key
Run this script and copy the output to your .env file
"""

import secrets

def generate_jwt_secret():
    """Generate a secure random JWT secret key"""
    secret_key = secrets.token_hex(32)
    return secret_key

if __name__ == "__main__":
    print("="*60)
    print("JWT Secret Key Generator")
    print("="*60)
    
    secret = generate_jwt_secret()
    
    print("\nYour new JWT secret key:")
    print("-"*60)
    print(secret)
    print("-"*60)
    
    print("\nCopy this key and paste it in your .env file:")
    print(f"JWT_SECRET_KEY={secret}")
    
    print("\n⚠️  Keep this key secret and never commit it to version control!")
