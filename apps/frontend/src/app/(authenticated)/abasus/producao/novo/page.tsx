'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createProduction, addConsumption, confirmProduction, fetchUnits,
  fetchStockItems, fetchEmployees, fetchSurgeryTypes, fetchProduction,
} from '@/modules/abasus/api';
import type { ProductionType, SurgerySubtype, Consumption, StockItem, UnitOption, EmployeeOption } from '@/modules/abasus/types';
import { SUBTYPE_LABELS } from '@/modules/abasus/types';

function fmtCurrency(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

type Step = 'dados' | 'insumos' | 'revisao';

export default function NovaProducaoPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('dados');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [surgeryTypes, setSurgeryTypes] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stkSearch, setStkSearch] = useState('');

  // Step 1: Basic info
  const [type, setType] = useState<ProductionType>('CONSULTA');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [competence, setCompetence] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [doctorName, setDoctorName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [secretaryId, setSecretaryId] = useState('');
  const [attendances, setAttendances] = useState(0);
  const [returns, setReturns] = useState(0);
  const [examType, setExamType] = useState('OCT');
  const [quantity, setQuantity] = useState(1);
  const [procedureType, setProcedureType] = useState('Facoemulsificação');
  const [surgerySubtype, setSurgerySubtype] = useState<SurgerySubtype>('CATARATA');
  const [technique, setTechnique] = useState('');
  const [unitValue, setUnitValue] = useState(0);

  // Step 2: Consumptions
  const [productionId, setProductionId] = useState('');
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);

  // Init
  useEffect(() => {
    fetchUnits().then(u => {
      const sus = u.find(x => x.name.toUpperCase().includes('SUS'));
      if (sus) { setUnitId(sus.id); setUnits([sus]); } else setUnits(u);
    });
    fetchEmployees().then(setEmployees);
    fetchSurgeryTypes().then(setSurgeryTypes);
    fetchStockItems().then(setStockItems);
  }, []);

  // Stock search
  useEffect(() => {
    const t = setTimeout(() => { fetchStockItems(stkSearch || undefined).then(setStockItems); }, 300);
    return () => clearTimeout(t);
  }, [stkSearch]);

  // ── Step 1: Create Draft ──
  const handleCreateDraft = async () => {
    setError('');
    if (!unitId) { setError('Unidade SUS não encontrada'); return; }
    if (!doctorName) { setError('Informe o médico'); return; }
    if (type === 'CONSULTA' && attendances + returns === 0) { setError('Informe atendimentos ou retornos'); return; }
    if ((type === 'EXAME' || type === 'CIRURGIA') && quantity < 1) { setError('Quantidade mínima: 1'); return; }

    setSaving(true);
    try {
      const payload: any = {
        type, date, competence, doctor_name: doctorName,
        doctor_id: doctorId || undefined, unit_value: unitValue,
      };
      if (type === 'CONSULTA') {
        payload.secretary_id = secretaryId || undefined;
        payload.attendances = attendances;
        payload.returns = returns;
      }
      if (type === 'EXAME') { payload.exam_type = examType; payload.quantity = quantity; }
      if (type === 'CIRURGIA') {
        payload.procedure_type = procedureType; payload.surgery_subtype = surgerySubtype;
        payload.quantity = quantity; payload.technique = technique || undefined;
      }

      const prod = await createProduction(unitId, payload);
      setProductionId(prod.id);

      // If type needs insumos, go to step 2
      if (type === 'CIRURGIA') { setStep('insumos'); }
      else { setStep('revisao'); }
    } catch (e: any) { setError(e.message || 'Erro ao criar'); }
    finally { setSaving(false); }
  };

  // ── Step 2: Add consumption ──
  const handleAddConsumption = async (item: StockItem) => {
    if (!productionId) return;
    setError('');
    try {
      const c = await addConsumption(productionId, {
        stock_item_id: item.id, quantity: 1,
      });
      setConsumptions(prev => [...prev, c]);
    } catch (e: any) { setError(e.message); }
  };

  // ── Step 3: Confirm ──
  const handleConfirm = async () => {
    if (!productionId) return;
    if (!confirm('Confirmar produção? Isso baixará estoque e registrará no financeiro.')) return;
    setSaving(true); setError('');
    try {
      await confirmProduction(productionId);
      setSuccess('Produção confirmada com sucesso!');
      setTimeout(() => router.push('/abasus/producao'), 1500);
    } catch (e: any) { setError(e.message || 'Erro ao confirmar'); }
    finally { setSaving(false); }
  };

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none w-full';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
  const btnP = 'bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 text-sm disabled:opacity-50';
  const btnS = 'border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50';

  const doctors = employees.filter(e => e.role?.toLowerCase().includes('médic'));
  const secretaries = employees.filter(e => !e.role?.toLowerCase().includes('médic'));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/abasus/producao" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Lançamento SUS</h1>
          <p className="text-sm text-gray-500">
            {step === 'dados' ? 'Etapa 1: Dados da produção' : step === 'insumos' ? 'Etapa 2: Insumos consumidos' : 'Etapa 3: Revisão e confirmação'}
          </p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">{success}</div>}

      {/* ═══ STEP 1: DADOS ═══ */}
      {step === 'dados' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          {/* Type selector */}
          <div>
            <label className={labelCls}>Tipo de Produção *</label>
            <div className="flex gap-2">
              {(['CONSULTA', 'EXAME', 'CIRURGIA'] as ProductionType[]).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border transition ${type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {t === 'CONSULTA' ? '🩺 Consulta' : t === 'EXAME' ? '🔬 Exame' : '🔪 Cirurgia'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelCls}>Data *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Competência *</label><input type="month" value={competence} onChange={e => setCompetence(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Valor Unitário SUS (R$)</label>
              <input type="number" step="0.01" min="0" value={unitValue} onChange={e => setUnitValue(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Médico *</label>
              <input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Nome do médico" className={inputCls} list="docs" />
              <datalist id="docs">{doctors.map(d => <option key={d.id} value={d.name} />)}</datalist>
            </div>
            {type === 'CONSULTA' && (
              <div>
                <label className={labelCls}>Secretária</label>
                <select value={secretaryId} onChange={e => setSecretaryId(e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {secretaries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Type-specific fields */}
          {type === 'CONSULTA' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Atendimentos *</label>
                <input type="number" min="0" value={attendances} onChange={e => setAttendances(parseInt(e.target.value) || 0)} className={inputCls} /></div>
              <div><label className={labelCls}>Retornos</label>
                <input type="number" min="0" value={returns} onChange={e => setReturns(parseInt(e.target.value) || 0)} className={inputCls} /></div>
            </div>
          )}

          {type === 'EXAME' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Tipo de Exame *</label>
                <input type="text" value={examType} onChange={e => setExamType(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Quantidade *</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className={inputCls} /></div>
            </div>
          )}

          {type === 'CIRURGIA' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Subtipo *</label>
                  <select value={surgerySubtype} onChange={e => setSurgerySubtype(e.target.value as SurgerySubtype)} className={inputCls}>
                    {Object.entries(SUBTYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Procedimento</label>
                  <input type="text" value={procedureType} onChange={e => setProcedureType(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Quantidade *</label>
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Técnica</label>
                  <input type="text" value={technique} onChange={e => setTechnique(e.target.value)} className={inputCls} placeholder="Ex: Faco + Implante" /></div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/abasus/producao" className={btnS}>Cancelar</Link>
            <button onClick={handleCreateDraft} disabled={saving} className={btnP}>
              {saving ? 'Criando...' : type === 'CIRURGIA' ? 'Próximo: Insumos →' : 'Próximo: Revisão →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: INSUMOS ═══ */}
      {step === 'insumos' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            🏥 Produção criada como <strong>Rascunho</strong> · Tipo: <strong>{type}</strong>
            {surgerySubtype && <> · Subtipo: <strong>{SUBTYPE_LABELS[surgerySubtype]}</strong></>}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Adicionar Insumos do Estoque</h3>
            <input type="text" placeholder="Buscar item por nome, SKU ou categoria..."
              value={stkSearch} onChange={e => setStkSearch(e.target.value)} className={inputCls} />
            {stockItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {stockItems.map(item => (
                  <button key={item.id} onClick={() => handleAddConsumption(item)}
                    className="text-left border border-gray-100 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/50 transition text-sm">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.category} · {item.sku} · Custo: {fmtCurrency(Number(item.cost))}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Added consumptions */}
          {consumptions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b"><h3 className="text-sm font-semibold text-gray-700">Insumos Adicionados ({consumptions.length})</h3></div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 text-xs uppercase border-b">
                  <th className="px-5 py-2">Item</th><th className="px-5 py-2">Categoria</th><th className="px-5 py-2 text-center">Qtd</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {consumptions.map(c => (
                    <tr key={c.id}><td className="px-5 py-2 font-medium">{c.stock_item?.name}</td>
                      <td className="px-5 py-2 text-gray-500">{c.stock_item?.category}</td>
                      <td className="px-5 py-2 text-center">{c.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('dados')} className={btnS}>← Voltar</button>
            <button onClick={() => setStep('revisao')} className={btnP}>Próximo: Revisão →</button>
          </div>
        </>
      )}

      {/* ═══ STEP 3: REVISÃO ═══ */}
      {step === 'revisao' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Resumo da Produção</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{type}</span></div>
              <div><span className="text-gray-500">Data:</span> <span className="font-medium">{date}</span></div>
              <div><span className="text-gray-500">Competência:</span> <span className="font-medium">{competence}</span></div>
              <div><span className="text-gray-500">Médico:</span> <span className="font-medium">{doctorName}</span></div>
              {type === 'CONSULTA' && <div><span className="text-gray-500">Pacientes:</span> <span className="font-medium">{attendances + returns}</span></div>}
              {type === 'EXAME' && <div><span className="text-gray-500">Exame:</span> <span className="font-medium">{examType} × {quantity}</span></div>}
              {type === 'CIRURGIA' && (
                <>
                  <div><span className="text-gray-500">Cirurgia:</span> <span className="font-medium">{SUBTYPE_LABELS[surgerySubtype]} × {quantity}</span></div>
                  <div><span className="text-gray-500">Insumos:</span> <span className="font-medium">{consumptions.length} itens</span></div>
                </>
              )}
              <div><span className="text-gray-500">Valor unit.:</span> <span className="font-medium">{fmtCurrency(unitValue)}</span></div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(type === 'CIRURGIA' ? 'insumos' : 'dados')} className={btnS}>← Voltar</button>
            <div className="flex gap-3">
              <button onClick={() => router.push('/abasus/producao')} className={btnS}>Salvar como Rascunho</button>
              <button onClick={handleConfirm} disabled={saving} className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 text-sm disabled:opacity-50">
                {saving ? 'Confirmando...' : '✓ Confirmar Produção'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
