import { Info } from "lucide-react";

export function MessageVariableHelper() {
    return (
        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-md p-3">
            <p className="text-xs font-semibold text-blue-800 flex items-center gap-1 mb-2">
                <Info className="w-3 h-3" /> Variabel yang dapat digunakan:
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{nama_client}`}</span>
                <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{jumlah_tagihan}`}</span>
                <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{tanggal_jatuh_tempo}`}</span>
                <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{nama_perusahaan}`}</span>
            </div>
        </div>
    );
}
