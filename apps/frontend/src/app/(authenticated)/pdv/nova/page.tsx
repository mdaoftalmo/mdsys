'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSale, addItem, fetchServices, fetchConvenios,
  fetchUnits, searchPatients, confirmSale,
} from '@/modules/sales/api';
import type { ServiceCatalogItem, ConvenioItem, UnitOption, SaleItem } from '@/modules/sales/types';
import { PAYMENT_LABELS } from '@/modules/sales/types';

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function NovaSalePage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<'setup' | 'items'>('setup');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Setup form
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [type, setType] = useState<'PARTICULAR' | 'CONVENIO'>('PARTICULAR');
  const [convenios, setConvenios] = useState<ConvenioItem[]>([]);
  const [convenioId, setConvenioId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [visitType, setVisitType] = useState('primeira');
  const [notes, setNotes] = useState('');

  // Items step
  const [saleId, setSaleId] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [svcSearch, setSvcSearch] = useState('');
  const [saleTotals, setSaleTotals] = useState({ subtotal: 0, discount: 0, total: 0 });

  // Init
  useEffect(() => {
    fetchUnits().then(u => { setUnits(u); if (u.length) setUnitId(u[0].id); });
    fetchConvenios().then(setConvenios).catch(() => {});
    fetchServices().then(setServices).catch(() => {});
  }, []);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(() => {
      searchPatients(patientSearch).then((res: any) => setPatientResults(res.data || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Service search
  useEffect(() => {
    if (!svcSearch) { fetchServices().then(setServices); return; }
    const t = setTimeout(() => {
      fetchServices(svcSearch).then(setServices).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [svcSearch]);

  // Recalc totals
  const recalcTotals = useCallback((itemList: SaleItem[]) => {
    const subtotal = itemList.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
    const discount = itemList.reduce((s, i) => s + Number(i.discount), 0);
    setSaleTotals({ subtotal, discount, total: subtotal - discount });
  }, []);

  // ── Step 1: Create Draft ──
  const handleCreateDraft = async () => {
    setError('');
    if (!unitId) { setError('Selecione uma unidade'); return; }
    if (!selectedPatient) { setError('Selecione um paciente'); return; }

    setSaving(true);
    try {
      const sale = await createSale(unitId, {
        patient_id: selectedPatient.id,
        convenio_id: type === 'CONVENIO' && convenioId ? convenioId : undefined,
        payment_method: type === 'CONVENIO' ? 'CONVENIO' : paymentMethod,
        visit_type: visitType,
        notes: notes || undefined,
      });
      setSaleId(sale.id);
      setStep('items');
    } catch (e: any) {
      setError(e.message || 'Erro ao criar venda');
    } finally {
      setSaving(false);
    }
  };

  // ── Add Item ──
  const handleAddService = async (svc: ServiceCatalogItem) => {
    if (!saleId) return;
    setError('');
    try {
      const price = type === 'CONVENIO' && svc.price_card ? Number(svc.price_card) : Number(svc.price_particular);
      const item = await addItem(saleId, {
        service_id: svc.id,
        description: svc.name,
        quantity: 1,
        unit_price: price,
        discount: 0,
      });
      const newItems = [...items, item];
      setItems(newItems);
      recalcTotals(newItems);
    } catch (e: any) {
      setError(e.message || 'Erro ao adicionar item');
    }
  };

  // ── Add Manual Item ──
  const [manualDesc, setManualDesc] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const handleAddManual = async () => {
    if (!saleId || !manualDesc || !manualPrice) return;
    setError('');
    try {
      const item = await addItem(saleId, {
        description: manualDesc,
        quantity: 1,
        unit_price: parseFloat(manualPrice),
        discount: 0,
      });
      const newItems = [...items, item];
      setItems(newItems);
      recalcTotals(newItems);
      setManualDesc('');
      setManualPrice('');
    } catch (e: any) {
      setError(e.message || 'Erro ao adicionar item');
    }
  };

  // ── Confirm ──
  const handleConfirm = async () => {
    if (!saleId) return;
    if (items.length === 0) { setError('Adicione pelo menos um item'); return; }
    if (!confirm('Confirmar venda? Isso criará o recebível financeiro.')) return;
    setSaving(true);
    setError('');
    try {
      await confirmSale(saleId);
      setSuccess('Venda confirmada com sucesso!');
      setTimeout(() => router.push(`/pdv/${saleId}`), 1200);
    } catch (e: any) {
      setError(e.message || 'Erro ao confirmar venda');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none w-full';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
  const btnPrimary = 'bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition text-sm disabled:opacity-50';
  const btnSecondary = 'border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/pdv')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Venda</h1>
          <p className="text-sm text-gray-500">
            {step === 'setup' ? 'Etapa 1: Dados da venda' : 'Etapa 2: Adicionar itens e confirmar'}
          </p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">{success}</div>}

      {/* ═══ STEP 1: SETUP ═══ */}
      {step === 'setup' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Unit */}
            <div>
              <label className={labelCls}>Unidade *</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls}>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            {/* Visit type */}
            <div>
              <label className={labelCls}>Tipo de Visita</label>
              <select value={visitType} onChange={(e) => setVisitType(e.target.value)} className={inputCls}>
                <option value="primeira">Primeira consulta</option>
                <option value="retorno">Retorno</option>
                <option value="pos_op">Pós-operatório</option>
                <option value="exame">Exame</option>
                <option value="cirurgia">Cirurgia</option>
              </select>
            </div>
          </div>

          {/* Patient search */}
          <div>
            <label className={labelCls}>Paciente *</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div>
                  <span className="font-medium text-blue-900">{selectedPatient.name}</span>
                  <span className="text-xs text-blue-600 font-mono ml-3">{selectedPatient.cpf}</span>
                </div>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-blue-600 text-xs underline">
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input type="text" placeholder="Buscar por nome ou CPF..."
                  value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
                  className={inputCls} autoFocus />
                {patientResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patientResults.map((p: any) => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientSearch(''); }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-gray-400 font-mono text-xs ml-2">{p.cpf}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type + Convenio + Payment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Tipo *</label>
              <div className="flex gap-2">
                <button onClick={() => { setType('PARTICULAR'); setConvenioId(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${type === 'PARTICULAR' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  Particular
                </button>
                <button onClick={() => setType('CONVENIO')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${type === 'CONVENIO' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  Convênio
                </button>
              </div>
            </div>

            {type === 'CONVENIO' && (
              <div>
                <label className={labelCls}>Convênio *</label>
                <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {convenios.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {type === 'PARTICULAR' && (
              <div>
                <label className={labelCls}>Forma de Pagamento *</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                  {Object.entries(PAYMENT_LABELS).filter(([k]) => k !== 'CONVENIO').map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className={inputCls} placeholder="Observações sobre a venda..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => router.push('/pdv')} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreateDraft} disabled={saving} className={btnPrimary}>
              {saving ? 'Criando...' : 'Próximo: Adicionar Itens →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: ITEMS ═══ */}
      {step === 'items' && (
        <>
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex items-center gap-3">
            <span className="text-lg">🧾</span>
            <span>
              Venda criada como <strong>Rascunho</strong> · Paciente: <strong>{selectedPatient?.name}</strong> ·
              Unidade: <strong>{units.find(u => u.id === unitId)?.name}</strong>
              {type === 'CONVENIO' && <> · Convênio: <strong>{convenios.find(c => c.id === convenioId)?.name}</strong></>}
            </span>
          </div>

          {/* Service catalog picker */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Adicionar Serviço do Catálogo</h3>
            <input type="text" placeholder="Buscar serviço por nome, categoria ou TUSS..."
              value={svcSearch} onChange={(e) => setSvcSearch(e.target.value)}
              className={inputCls} />
            {services.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {services.map(svc => (
                  <button key={svc.id} onClick={() => handleAddService(svc)}
                    className="text-left border border-gray-100 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/50 transition text-sm">
                    <div className="font-medium text-gray-900">{svc.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {svc.category} {svc.tuss_code && `· ${svc.tuss_code}`}
                    </div>
                    <div className="text-xs font-semibold text-blue-700 mt-1">
                      {fmtCurrency(Number(svc.price_particular))}
                      {svc.price_card && <span className="text-gray-400 font-normal"> · Cartão: {fmtCurrency(Number(svc.price_card))}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Manual item */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-medium text-gray-500 mb-2">Ou adicionar item manual:</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <input type="text" placeholder="Descrição" value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)} className={inputCls} />
                </div>
                <div className="w-36">
                  <input type="number" step="0.01" min="0" placeholder="Valor R$" value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)} className={inputCls} />
                </div>
                <button onClick={handleAddManual} disabled={!manualDesc || !manualPrice}
                  className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition disabled:opacity-30">
                  + Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Serviço / Descrição</th>
                  <th className="px-4 py-3 font-medium text-center">Qtd</th>
                  <th className="px-4 py-3 font-medium text-right">Preço Unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Desconto</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum item adicionado</td></tr>
                ) : items.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      {item.service?.category && <div className="text-xs text-gray-400">{item.service.category}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">{fmtCurrency(Number(item.unit_price))}</td>
                    <td className="px-4 py-3 text-right text-red-600">{Number(item.discount) > 0 ? `- ${fmtCurrency(Number(item.discount))}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(Number(item.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                <div className="flex justify-end gap-12 text-sm">
                  <div className="text-gray-500">Subtotal: <span className="font-medium text-gray-800">{fmtCurrency(saleTotals.subtotal)}</span></div>
                  {saleTotals.discount > 0 && <div className="text-red-600">Desconto: -{fmtCurrency(saleTotals.discount)}</div>}
                  <div className="text-lg font-bold text-gray-900">Total: {fmtCurrency(saleTotals.total)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button onClick={() => router.push(`/pdv/${saleId}`)} className={btnSecondary}>
              Salvar como Rascunho
            </button>
            <button onClick={handleConfirm} disabled={saving || items.length === 0} className={btnPrimary}>
              {saving ? 'Confirmando...' : '✓ Confirmar Venda'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
