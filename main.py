import os
from google import genai
from dotenv import load_dotenv

# Load all configurations stored inside the local .env file
load_dotenv()
 
# The SDK automatically checks for the 'GEMINI_API_KEY' environment variable.
# If it doesn't find it, it checks for 'GOOGLE_API_KEY'.
if "GEMINI_API_KEY" not in os.environ and "GOOGLE_API_KEY" not in os.environ:
    raise ValueError("API Key not found. Please set the GEMINI_API_KEY environment variable.")

# Initialize the client (No need to pass the key explicitly if using env vars)
client = genai.Client()

# Generate a response using Gemini 2.5 Flash
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='Explain quantum computing in one short sentence.'
)

print(response.text)
