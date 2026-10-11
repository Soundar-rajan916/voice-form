import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { brandConfig } from '../brand';

export function ReceiptSlipPrint({ submission, formTitle, lang = 'ta' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const ref = submission?.reference_number || 'CS-DEMO-REF1';
  const office = lang === 'ta' ? brandConfig.officeNameTa : brandConfig.officeName;
  const disclaimer = lang === 'ta' ? brandConfig.disclaimerTa : brandConfig.disclaimerEn;

  useEffect(() => {
    if (ref) {
      QRCode.toDataURL(ref, { width: 140, margin: 1 }, (err, url) => {
        if (!err) setQrDataUrl(url);
      });
    }
  }, [ref]);

  const chars = ref.split('');
  const dateStr = submission?.submitted_at
    ? new Date(submission.submitted_at).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN')
    : new Date().toLocaleString();

  return (
    <div className="receipt-slip-80mm bg-white text-[#23272F] p-4 font-sans-counter border border-dashed border-[#23272F]/30 mx-auto max-w-[320px]">
      {/* Header */}
      <div className="text-center border-b border-[#23272F] pb-3 mb-3">
        <h1 className="text-base font-bold font-serif-printed">{office}</h1>
        <p className="text-xs text-[#23272F]/80">{lang === 'ta' ? 'விண்ணப்ப ரசீது' : 'Application Receipt Slip'}</p>
        <p className="text-sm font-semibold mt-1 text-[#1F3FBF]">{formTitle || 'Citizen Service'}</p>
      </div>

      {/* Reference Number in Boxed Cells */}
      <div className="my-3 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[#23272F]/80 mb-1.5">
          {lang === 'ta' ? 'விண்ணப்ப குறிப்பு எண்' : 'Reference Number'}
        </p>
        <div className="flex justify-center flex-wrap gap-1">
          {chars.map((c, i) => (
            <span
              key={`char-${i}`}
              className="inline-flex items-center justify-center w-6 h-7 border border-[#23272F] text-sm font-bold font-mono bg-[#FCFCFA]"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* QR Code (Contains reference number only) */}
      {qrDataUrl && (
        <div className="my-3 flex flex-col items-center">
          <img src={qrDataUrl} alt="Reference QR Code" className="w-28 h-28 object-contain" />
          <span className="text-[10px] text-[#23272F]/70 mt-1">
            {lang === 'ta' ? 'குறிப்பு எண் QR' : 'Reference QR'}
          </span>
        </div>
      )}

      {/* Meta Information */}
      <div className="text-xs border-t border-b border-[#23272F]/20 py-2 my-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-[#23272F]/70">{lang === 'ta' ? 'தேதி & நேரம்:' : 'Date & Time:'}</span>
          <span className="font-semibold">{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#23272F]/70">{lang === 'ta' ? 'சேவை முறை:' : 'Channel:'}</span>
          <span className="font-semibold">{submission?.channel || 'self_service'}</span>
        </div>
      </div>

      {/* Notice & Disclaimer */}
      <div className="mt-3 text-center space-y-2">
        <p className="text-[11px] font-semibold text-[#1F3FBF]">
          {lang === 'ta'
            ? 'இந்த ரசீதை உங்கள் விண்ணப்ப நிலையை அறிய பத்திரமாக வைத்திருக்கவும்.'
            : 'Keep this slip to check your application status at the office.'}
        </p>
        <p className="text-[10px] text-[#23272F]/75 border-t border-dashed border-[#23272F]/30 pt-2 italic">
          {disclaimer}
        </p>
      </div>
    </div>
  );
}

export default ReceiptSlipPrint;
