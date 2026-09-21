import React, { useState } from 'react';
import { SchoolSetting } from '../../types';
import { StorageService } from '../../lib/storage';

interface PrintHeaderProps {
  settings?: SchoolSetting;
  documentTitle: string;
  documentSubtitle?: string;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({
  settings: propSettings,
  documentTitle,
  documentSubtitle
}) => {
  const settings = propSettings || StorageService.getSettings();
  const [imgError, setImgError] = useState(false);

  // Retrieve logo url from passed settings or live StorageService or local backup
  const rawLogo =
    settings?.logoUrl ||
    StorageService.getSettings()?.logoUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('aus_school_logo') || '' : '');
  const cleanLogo = typeof rawLogo === 'string' ? rawLogo.trim() : '';

  React.useEffect(() => {
    setImgError(false);
  }, [cleanLogo]);

  const showLogo = cleanLogo.length > 0 && !imgError;

  return (
    <div className="border-b-2 border-black pb-3 mb-6 font-serif text-black">
      <div className="flex items-center justify-between gap-4">
        {showLogo ? (
          <div className="w-20 h-20 max-w-20 max-h-20 shrink-0 flex items-center justify-center overflow-hidden">
            <img
              src={cleanLogo}
              alt="Logo Sekolah"
              onError={() => setImgError(true)}
              className="max-w-full max-h-full object-contain block print:block"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="w-20 h-20 border-2 border-black rounded flex flex-col items-center justify-center text-center p-1 text-[10px] font-bold shrink-0">
            <span>LOGO</span>
            <span>SEKOLAH</span>
          </div>
        )}

        <div className="flex-1 text-center">
          <p className="text-xs font-semibold tracking-wider uppercase text-gray-800">
            PEMERINTAH DAERAH PROVINSI {(settings.province || '').toUpperCase()}
          </p>
          <p className="text-xs font-semibold tracking-wider uppercase text-gray-800">
            DINAS PENDIDIKAN DAN KEBUDAYAAN
          </p>
          <h1 className="text-lg md:text-xl font-bold uppercase tracking-wide text-black leading-tight">
            {settings.schoolName}
          </h1>
          <p className="text-xs text-gray-800 leading-tight mt-0.5">
            {settings.address}
            {settings.village ? `, Kel. ${settings.village}` : ''}
            {settings.district ? `, Kec. ${settings.district}` : ''}
            {settings.city ? `, ${settings.city}` : ''}
            {settings.postalCode ? ` - ${settings.postalCode}` : ''}
          </p>
          <p className="text-[11px] text-gray-700 mt-0.5">
            NPSN: {settings.npsn} {settings.nss ? `| NSS: ${settings.nss}` : ''} | Telp: {settings.phone} | Email: {settings.email}
          </p>
        </div>

        <div className="w-20 h-20 invisible shrink-0"></div>
      </div>

      {/* Double line Kop Surat */}
      <div className="mt-3 border-t-2 border-b border-black h-1"></div>

      {/* Document Title */}
      <div className="text-center mt-4">
        <h2 className="text-base font-bold uppercase tracking-wider underline">
          {documentTitle}
        </h2>
        {documentSubtitle && (
          <p className="text-xs font-medium text-gray-700 mt-0.5">
            {documentSubtitle}
          </p>
        )}
      </div>
    </div>
  );
};
