import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, XCircle, Loader2, FileText, CreditCard } from 'lucide-react';
import { Card } from '../components/ui';
import { useStore } from '../store';
import type {
  ImportPreviewResponse,
  ImportTransactionPreview,
  Category,
  CreditCard as CreditCardType
} from '../types';

export default function OFXImport() {
  const { categories, creditCards } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [editedTransactions, setEditedTransactions] = useState<ImportTransactionPreview[]>([]);
  const [selectedCreditCard, setSelectedCreditCard] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Valida extensão
      if (!selectedFile.name.toLowerCase().endsWith('.ofx')) {
        setError('Por favor, selecione um arquivo OFX válido');
        return;
      }
      setFile(selectedFile);
      setError('');
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      // Lê o arquivo como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Converte ArrayBuffer para base64 (compatível com UTF-8)
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = btoa(binary);

      // Faz o upload e recebe o preview
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/import/ofx/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          file_content: base64Content,
          credit_card_id: selectedCreditCard || null
        })
      });

      if (!response.ok) {
        // Tenta parsear como JSON, se falhar mostra o texto bruto
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Erro ao processar arquivo OFX');
        } else {
          const errorText = await response.text();
          console.error('Resposta não-JSON do servidor:', errorText);
          throw new Error(`Erro do servidor (${response.status}): Verifique os logs do backend`);
        }
      }

      const data: ImportPreviewResponse = await response.json();
      setPreview(data);
      setEditedTransactions(data.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], suggested_category_id: categoryId };
    setEditedTransactions(updated);
  };

  const handleDescriptionChange = (index: number, description: string) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], suggested_description: description };
    setEditedTransactions(updated);
  };

  const handleToggleTransaction = (index: number) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], is_duplicate: !updated[index].is_duplicate };
    setEditedTransactions(updated);
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    setError('');

    try {
      // Filtra apenas transações que não são duplicatas (ou que foram manualmente selecionadas)
      const transactionsToImport = editedTransactions
        .filter(t => !t.is_duplicate)
        .map(t => ({
          category_id: t.suggested_category_id,
          amount: t.amount,
          date: t.date,
          description: t.suggested_description,
          status: t.status,
          is_duplicate: false
        }));

      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/import/ofx/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          transactions: transactionsToImport,
          credit_card_id: selectedCreditCard || null,
          skip_duplicates: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao importar transações');
      }

      const result = await response.json();
      setSuccess(`${result.imported_count} transações importadas com sucesso! ${result.skipped_count} duplicatas ignoradas.`);

      // Aguarda 2 segundos e redireciona para a página de transações
      setTimeout(() => {
        window.location.hash = '#/transactions';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar transações');
    } finally {
      setImporting(false);
    }
  };

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return 'Sem categoria';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Categoria não encontrada';
  };

  const getConfidenceBadge = (confidence: number | null | undefined) => {
    if (!confidence) return null;

    const percentage = Math.round(confidence * 100);
    let color = 'bg-red-100 text-red-800';
    if (percentage >= 80) color = 'bg-green-100 text-green-800';
    else if (percentage >= 50) color = 'bg-yellow-100 text-yellow-800';

    return (
      <span className={`text-xs px-2 py-1 rounded ${color}`}>
        {percentage}% confiança
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar OFX</h1>
        <p className="text-gray-600 mt-1">
          Importe transações de arquivos OFX exportados do seu banco
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">1. Selecione o arquivo OFX</h3>
          <div className="space-y-4">
            {/* Seleção de Cartão de Crédito (Opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cartão de Crédito (opcional)
              </label>
              <select
                value={selectedCreditCard}
                onChange={(e) => setSelectedCreditCard(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                disabled={loading || !!preview}
              >
                <option value="">Nenhum (transações de débito)</option>
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} - {card.brand}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Se o arquivo OFX for de um cartão de crédito, selecione o cartão correspondente
              </p>
            </div>

            {/* File Input */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <input
                type="file"
                accept=".ofx"
                onChange={handleFileChange}
                className="hidden"
                id="ofx-file-input"
                disabled={loading || !!preview}
              />
              <label
                htmlFor="ofx-file-input"
                className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
              >
                Clique para selecionar um arquivo OFX
              </label>
              {file && (
                <div className="mt-4 flex items-center justify-center text-sm text-gray-600">
                  <FileText className="h-4 w-4 mr-2" />
                  {file.name}
                </div>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || loading || !!preview}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Processando...
                </>
              ) : (
                'Processar Arquivo'
              )}
            </button>
          </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-green-800">{success}</div>
        </div>
      )}

      {/* Preview Section */}
      {preview && (
        <>
          {/* Account Info */}
          <Card className="mb-6 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Informações da Conta</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Tipo de Conta</p>
                  <p className="font-medium">{preview.account_info.account_type}</p>
                </div>
                <div>
                  <p className="text-gray-600">Número da Conta</p>
                  <p className="font-medium">{preview.account_info.account_id}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total de Transações</p>
                  <p className="font-medium">{preview.total_transactions}</p>
                </div>
                <div>
                  <p className="text-gray-600">Novas / Duplicadas</p>
                  <p className="font-medium">
                    <span className="text-green-600">{preview.new_count}</span> /{' '}
                    <span className="text-yellow-600">{preview.duplicate_count}</span>
                  </p>
                </div>
              </div>
          </Card>

          {/* Transactions Table */}
          <Card className="mb-6 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">2. Revise as transações ({editedTransactions.filter(t => !t.is_duplicate).length} para importar)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-left">Categoria</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {editedTransactions.map((txn, index) => (
                      <tr
                        key={index}
                        className={txn.is_duplicate ? 'bg-yellow-50 opacity-60' : ''}
                      >
                        <td className="px-4 py-3">{new Date(txn.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={txn.suggested_description}
                            onChange={(e) => handleDescriptionChange(index, e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            disabled={txn.is_duplicate}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <select
                              value={txn.suggested_category_id || ''}
                              onChange={(e) => handleCategoryChange(index, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                              disabled={txn.is_duplicate}
                            >
                              <option value="">Sem categoria</option>
                              {categories
                                .filter(c => c.type === (txn.amount > 0 ? 'INCOME' : 'EXPENSE'))
                                .map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))
                              }
                            </select>
                            {getConfidenceBadge(txn.confidence_score)}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {Math.abs(txn.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {txn.is_duplicate ? (
                            <button
                              onClick={() => handleToggleTransaction(index)}
                              className="flex items-center gap-1 text-yellow-600 hover:text-yellow-700 mx-auto"
                              title="Duplicada - clique para importar mesmo assim"
                            >
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Duplicada</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600 mx-auto">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Nova</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </Card>

          {/* Confirm Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setPreview(null);
                setFile(null);
                setEditedTransactions([]);
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={importing}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing || editedTransactions.filter(t => !t.is_duplicate).length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  Importando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar Importação ({editedTransactions.filter(t => !t.is_duplicate).length} transações)
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
