import React, { useState, useEffect } from 'react';
import { callApi } from '../../lib/api';
import { Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface LoginLogItem {
  id: string;
  waktu: string;
  peran: string;
  identifier: string;
  status: 'BERHASIL' | 'GAGAL';
  keterangan?: string;
}

export const RiwayatMasuk: React.FC = () => {
  const [logs, setLogs] = useState<LoginLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await callApi<LoginLogItem[]>('getLoginLogs');
      setLogs(res || []);
    } catch {
      // Fallback local storage
      const raw = localStorage.getItem('erapot_sd_login_logs_v2');
      if (raw) setLogs(JSON.parse(raw));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock size={22} className="text-navy-500" />
            <span>Riwayat Masuk Pengguna</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Catatan aktivitas login guru wali kelas dan administrator sekolah.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          title="Segarkan log"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Belum ada catatan aktivitas masuk.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Pengguna / Kelas</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {new Date(item.waktu).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold uppercase text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full ${
                        item.peran === 'admin' ? 'bg-blue-100 text-navy-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.peran}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {item.identifier}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'BERHASIL' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.status === 'BERHASIL' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        <span>{item.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {item.keterangan || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
