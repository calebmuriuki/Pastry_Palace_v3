#!/usr/bin/env python
"""
M-Pesa Credential Test Script
Run this to verify your M-Pesa credentials are working
"""

import os
import requests
import base64
from decouple import config

# Load credentials from .env
CONSUMER_KEY = config('MPESA_CONSUMER_KEY', default='')
CONSUMER_SECRET = config('MPESA_CONSUMER_SECRET', default='')
ENVIRONMENT = config('MPESA_ENVIRONMENT', default='sandbox')

# Determine base URL
BASE_URL = "https://sandbox.safaricom.co.ke" if ENVIRONMENT == 'sandbox' else "https://api.safaricom.co.ke"

def test_mpesa_credentials():
    """Test M-Pesa OAuth credentials"""
    
    print("=" * 60)
    print("M-PESA CREDENTIAL TEST")
    print("=" * 60)
    
    # Check if credentials exist
    if not CONSUMER_KEY or not CONSUMER_SECRET:
        print("❌ ERROR: M-Pesa credentials not found in .env file")
        print("\nMake sure your .env file has:")
        print("MPESA_CONSUMER_KEY=your_key_here")
        print("MPESA_CONSUMER_SECRET=your_secret_here")
        return False
    
    print(f"✓ Environment: {ENVIRONMENT}")
    print(f"✓ Base URL: {BASE_URL}")
    print(f"✓ Consumer Key: {CONSUMER_KEY[:20]}...")
    print(f"✓ Consumer Secret: {CONSUMER_SECRET[:20]}...")
    print()
    
    # Create Basic Auth
    auth_string = f"{CONSUMER_KEY}:{CONSUMER_SECRET}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    print("Testing OAuth token generation...")
    
    # Make request
    url = f"{BASE_URL}/oauth/v1/generate?grant_type=client_credentials"
    headers = {
        'Authorization': f'Basic {auth_b64}'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            if 'access_token' in data:
                print("✅ SUCCESS! M-Pesa credentials are valid!")
                print(f"✓ Access Token: {data['access_token'][:30]}...")
                print(f"✓ Expires In: {data.get('expires_in')} seconds")
                return True
            else:
                print("❌ ERROR: No access token in response")
                return False
        else:
            print("❌ ERROR: Failed to get access token")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 400:
                print("\n🔍 Common causes for 400 Bad Request:")
                print("1. Invalid Consumer Key or Consumer Secret")
                print("2. Credentials expired (get fresh ones from Safaricom portal)")
                print("3. Extra whitespace in .env file")
                print("4. App not subscribed to Lipa Na M-Pesa API")
                print("\n📝 To fix:")
                print("1. Go to https://developer.safaricom.co.ke/")
                print("2. Login → My Apps → Your App")
                print("3. Copy fresh Consumer Key and Consumer Secret")
                print("4. Update your .env file")
                print("5. Ensure 'Lipa Na M-Pesa Sandbox' is subscribed")
            
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: Network request failed")
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_mpesa_credentials()
    
    print()
    print("=" * 60)
    if success:
        print("✅ M-Pesa credentials are working!")
        print("You can now test STK Push from your frontend")
    else:
        print("❌ M-Pesa credentials are NOT working")
        print("Fix the issues above before testing STK Push")
    print("=" * 60)