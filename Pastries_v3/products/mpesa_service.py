# products/mpesa_service.py
"""
M-Pesa STK Push Integration Service
Uses the same credentials as test_mpesa.py
"""

import os
import requests
import base64
from datetime import datetime
from django.conf import settings


def initiate_stk_push(phone, amount, account_reference, transaction_desc):
    """
    Initiate M-Pesa STK Push payment.
    
    Args:
        phone (str): Phone number (format: 2547XXXXXXXX)
        amount (float): Amount to charge
        account_reference (str): Order number or reference
        transaction_desc (str): Description of transaction
    
    Returns:
        dict: Response with success status and checkout details
    """
    try:
        # Get M-Pesa credentials from settings (same as test_mpesa.py)
        consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
        consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')
        environment = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')
        shortcode = getattr(settings, 'MPESA_SHORTCODE', '174379')
        passkey = getattr(settings, 'MPESA_PASSKEY', '')
        callback_url = getattr(settings, 'MPESA_CALLBACK_URL', '')
        
        # Check if credentials are configured
        if not all([consumer_key, consumer_secret, shortcode, passkey]):
            return {
                'success': False,
                'error': 'M-Pesa credentials not configured'
            }
        
        # Determine base URL (same as test_mpesa.py)
        base_url = "https://sandbox.safaricom.co.ke" if environment == 'sandbox' else "https://api.safaricom.co.ke"
        
        # Format phone number
        phone = phone.replace('+', '').strip()
        phone = ''.join(filter(str.isdigit, phone))
        
        if phone.startswith('0'):
            phone = '254' + phone[1:]
        elif len(phone) == 9 and phone.startswith('7'):
            phone = '254' + phone
        elif len(phone) == 12 and phone.startswith('254'):
            pass  # Already correct format
        else:
            return {
                'success': False,
                'error': f'Invalid phone number format: {phone}'
            }
        
        # Create Basic Auth (same as test_mpesa.py)
        auth_string = f"{consumer_key}:{consumer_secret}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        # Get access token (same as test_mpesa.py)
        auth_url = f"{base_url}/oauth/v1/generate?grant_type=client_credentials"
        headers = {
            'Authorization': f'Basic {auth_b64}'
        }
        
        auth_response = requests.get(auth_url, headers=headers, timeout=30)
        
        if auth_response.status_code != 200:
            return {
                'success': False,
                'error': f'Failed to get M-Pesa access token: {auth_response.status_code}'
            }
        
        auth_data = auth_response.json()
        access_token = auth_data.get('access_token')
        
        if not access_token:
            return {
                'success': False,
                'error': 'No access token received from M-Pesa'
            }
        
        # Generate timestamp
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Generate password
        password_str = f"{shortcode}{passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode()
        
        # Prepare STK Push request
        stk_url = f"{base_url}/mpesa/stkpush/v1/processrequest"
        
        payload = {
            'BusinessShortCode': shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': 'CustomerPayBillOnline',
            'Amount': int(amount),
            'PartyA': phone,
            'PartyB': shortcode,
            'PhoneNumber': phone,
            'CallBackURL': callback_url or 'https://yourdomain.com/api/payments/mpesa/callback/',
            'AccountReference': account_reference[:12],
            'TransactionDesc': transaction_desc[:36]
        }
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(stk_url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ResponseCode') == '0':
                return {
                    'success': True,
                    'checkout_request_id': data.get('CheckoutRequestID'),
                    'merchant_request_id': data.get('MerchantRequestID'),
                    'response_code': data.get('ResponseCode'),
                    'response_description': data.get('ResponseDescription'),
                    'customer_message': data.get('CustomerMessage'),
                }
            else:
                return {
                    'success': False,
                    'error': data.get('ResponseDescription', 'STK Push failed'),
                    'response_code': data.get('ResponseCode'),
                }
        else:
            return {
                'success': False,
                'error': f'M-Pesa API error: {response.status_code}',
                'response': response.text
            }
            
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': 'M-Pesa API timeout - please try again'
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': 'Could not connect to M-Pesa API - check your internet connection'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'M-Pesa error: {str(e)}'
        }


def query_stk_status(checkout_request_id):
    """
    Query the status of an STK Push transaction.
    
    Args:
        checkout_request_id (str): The checkout request ID from initiate_stk_push
    
    Returns:
        dict: Status of the transaction
    """
    try:
        consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
        consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')
        environment = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')
        shortcode = getattr(settings, 'MPESA_SHORTCODE', '174379')
        passkey = getattr(settings, 'MPESA_PASSKEY', '')
        
        if not all([consumer_key, consumer_secret, shortcode, passkey]):
            return {
                'success': False,
                'error': 'M-Pesa credentials not configured'
            }
        
        base_url = "https://sandbox.safaricom.co.ke" if environment == 'sandbox' else "https://api.safaricom.co.ke"
        
        # Get access token
        auth_string = f"{consumer_key}:{consumer_secret}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        auth_url = f"{base_url}/oauth/v1/generate?grant_type=client_credentials"
        headers = {'Authorization': f'Basic {auth_b64}'}
        
        auth_response = requests.get(auth_url, headers=headers, timeout=10)
        
        if auth_response.status_code != 200:
            return {
                'success': False,
                'error': 'Failed to get access token'
            }
        
        access_token = auth_response.json().get('access_token')
        
        # Query status
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password_str = f"{shortcode}{passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode()
        
        query_url = f"{base_url}/mpesa/stkpushquery/v1/query"
        
        payload = {
            'BusinessShortCode': shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'CheckoutRequestID': checkout_request_id
        }
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(query_url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            return {
                'success': True,
                'data': data
            }
        else:
            return {
                'success': False,
                'error': f'Query failed: {response.status_code}'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# Optional: Test function to verify M-Pesa service is working
def test_mpesa_service():
    """
    Test the M-Pesa service by attempting to get an access token.
    This is similar to test_mpesa.py but integrated into the service.
    """
    consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
    consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')
    environment = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')
    
    if not consumer_key or not consumer_secret:
        return {
            'success': False,
            'error': 'M-Pesa credentials not configured in settings'
        }
    
    base_url = "https://sandbox.safaricom.co.ke" if environment == 'sandbox' else "https://api.safaricom.co.ke"
    
    auth_string = f"{consumer_key}:{consumer_secret}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    url = f"{base_url}/oauth/v1/generate?grant_type=client_credentials"
    headers = {'Authorization': f'Basic {auth_b64}'}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'access_token' in data:
                return {
                    'success': True,
                    'message': 'M-Pesa credentials are valid',
                    'access_token': data.get('access_token')[:30] + '...',
                    'expires_in': data.get('expires_in')
                }
        
        return {
            'success': False,
            'error': f'Failed to get access token: {response.status_code}',
            'response': response.text
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }