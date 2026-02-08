import asyncio
import os
import json
from backend.ai_openrouter import suggest_category, get_financial_analysis

async def test_categorization():
    """Testa categorização de transações"""
    print("=" * 60)
    print("TESTE: Categorização de Transações")
    print("=" * 60)
    
    categories = [
        {"id": "1", "name": "Alimentação", "type": "expense"},
        {"id": "2", "name": "Transporte", "type": "expense"},
        {"id": "3", "name": "Moradia", "type": "expense"},
        {"id": "4", "name": "Lazer", "type": "expense"},
        {"id": "5", "name": "Salário", "type": "income"},
    ]
    
    test_transactions = [
        {"description": "MERCADINHO SEMANA", "amount": -250.00},
        {"description": "UBER VIAGEM", "amount": -45.00},
        {"description": "IPVA CARRO", "amount": -1200.00},
        {"description": "CINEMA INGRESSOS", "amount": -60.00},
    ]
    
    for tx in test_transactions:
        print(f"\nTransação: {tx['description']} | Valor: R${abs(tx['amount']):.2f}")
        
        try:
            category_id, confidence = await suggest_category(
                description=tx["description"],
                amount=tx["amount"],
                categories=categories,
                previous_transactions=[],
                openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
                timeout_seconds=30,
                max_retries=2
            )
            
            if category_id:
                category_name = next((c["name"] for c in categories if c["id"] == category_id), "Desconhecida")
                print(f"✓ Categoria: {category_name} (ID: {category_id}) | Confiança: {confidence:.2f}")
            else:
                print("✗ Nenhuma categoria sugerida")
                
        except Exception as e:
            print(f"✗ Erro: {str(e)}")
    
    print("\n" + "=" * 60)

async def test_financial_analysis():
    """Testa análise financeira"""
    print("\nTESTE: Análise Financeira")
    print("=" * 60)
    
    try:
        analysis = await get_financial_analysis(
            balance=5000.00,
            monthly_income=8000.00,
            monthly_expenses=6500.00,
            reserves_total=15000.00,
            context="Estou tentando economizar para uma viagem em 6 meses",
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY")
        )
        
        print(f"✓ Análise gerada com sucesso!")
        print(f"\nConteúdo:\n{analysis}")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"✗ Erro: {str(e)}")
        print("\n" + "=" * 60)

def validate_json_response(content):
    """Valida se o conteúdo é um JSON válido"""
    try:
        json.loads(content)
        print("✓ JSON válido")
        return True
    except json.JSONDecodeError:
        print("✗ JSON inválido")
        return False

async def main():
    """Executa todos os testes"""
    if not os.getenv("OPENROUTER_API_KEY"):
        print("ERRO: OPENROUTER_API_KEY não está configurada!")
        print("Configure a variável de ambiente antes de executar os testes.")
        return
    
    print("\nIniciando testes do OpenRouter...")
    print(f"Modelo Primary: {os.getenv('OPENROUTER_MODEL', 'mistralai/mistral-small-3.1-24b-instruct:free')}")
    print(f"Modelo Fallback: qwen/qwen3-next-80b-a3b-instruct:free")
    print()
    
    await test_categorization()
    await test_financial_analysis()
    
    print("\nTodos os testes concluídos!")

if __name__ == "__main__":
    asyncio.run(main())
