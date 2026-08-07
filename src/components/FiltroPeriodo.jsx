import React from 'react';
import { RANGOS } from '../utils/fecha.js';
import { CalendarRange } from 'lucide-react';

export default function FiltroPeriodo({ valor, onChange, custom, onCustom }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
                {RANGOS.map(r => (
                    <button key={r.id} onClick={() => onChange(r.id)}
                        className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition ${valor === r.id
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
                        {r.label}
                    </button>
                ))}
                <button onClick={() => onChange('custom')}
                    className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition flex items-center gap-1.5 ${valor === 'custom'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
                    <CalendarRange size={13} /> Personalizado
                </button>
            </div>

            {valor === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Del</span>
                    <input type="date" value={custom?.desde || ''}
                        onChange={(e) => onCustom({ ...custom, desde: e.target.value })}
                        className="p-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">al</span>
                    <input type="date" value={custom?.hasta || ''}
                        onChange={(e) => onCustom({ ...custom, hasta: e.target.value })}
                        className="p-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none" />
                </div>
            )}
        </div>
    );
}