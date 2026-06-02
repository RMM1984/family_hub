import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Ajustes</h2>
        <p className="text-sm text-slate-500">Configuracion del tenant, usuarios y preferencias.</p>
      </div>
      <Card className="p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Tenant</dt>
            <dd className="font-semibold">familia-demo</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Rol activo</dt>
            <dd className="font-semibold">admin</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Formato moneda</dt>
            <dd className="font-semibold">EUR · es-ES</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Alertas documentos</dt>
            <dd className="font-semibold">60 dias antes</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
