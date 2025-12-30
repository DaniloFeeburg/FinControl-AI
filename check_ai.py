from google import genai
import os

# Certifique-se de que sua API KEY está configurada
client = genai.Client(api_key="AIzaSyCJTl9sPAM2_XdCXIK23MTfahWXEqzcEY8")

print("Listando modelos disponíveis...")
for m in client.models.list():
    if hasattr(m, 'supported_generation_methods') and 'generateContent' in m.supported_generation_methods:
        print(m.name)
    elif hasattr(m, 'name'):
        # Nova API pode não ter supported_generation_methods, então lista todos
        print(m.name)