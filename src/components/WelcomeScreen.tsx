import React, { useCallback, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Upload, FileSpreadsheet, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function WelcomeScreen() {
  const { loadFromExcel } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      loadFromExcel(buffer);
    } finally {
      setLoading(false);
    }
  }, [loadFromExcel]);

  const handleUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) processFile(file);
    };
    input.click();
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, hsl(210 40% 96%), hsl(214 32% 91%))' }}>
      <Card className="max-w-[480px] w-full p-10 text-center space-y-6 animate-fade-in rounded-[20px] shadow-lg">
        <div className="w-16 h-16 rounded-full bg-info-light mx-auto flex items-center justify-center">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">SyncSheet - Gestão Financeira</h1>
          <p className="text-sm text-muted-foreground mt-1 italic">Sua planilha, seu sistema, seus dados.</p>
          <p className="text-muted-foreground mt-3">Carregue sua planilha para começar a gerenciar seu negócio</p>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={handleUpload}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200",
            dragging ? "border-primary bg-info-light" : "border-border hover:border-primary"
          )}
        >
          {loading ? (
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">Arraste sua planilha aqui</p>
              <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-3">Formatos aceitos: .xlsx, .xls</p>
            </>
          )}
        </div>
        <Button onClick={handleUpload} disabled={loading} className="w-full h-11 text-base" size="lg">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          Selecionar Planilha .xlsx
        </Button>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3 h-3" />
          <span>🔒 Seus dados não saem do navegador</span>
        </div>
      </Card>
      <footer className="mt-6 text-xs text-muted-foreground">
        © SyncSheet 2026 - Todos os direitos reservados
      </footer>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
