import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Camera,
  FolderOpen,
  X,
  Sparkles,
  RotateCcw,
  Check,
  Calendar,
  Wallet as WalletIcon,
  Tag,
  Layers,
  ZoomIn,
  AlertCircle,
  SwitchCamera,
  Crosshair,
} from 'lucide-react';
import { useStore } from '../store';
import { todayISO, uid } from '../db';
import { currencySymbol } from '../utils';
import type { ExpenseInitialData } from './ExpenseModal';

export interface ParsedReceiptItem {
  name: string;
  quantity?: number;
  price: number;
  selected?: boolean;
}

export interface ParsedReceiptData {
  merchantName: string;
  description: string;
  totalAmount: number;
  currency?: string;
  date: string;
  category: string;
  suggestedWallet?: string;
  taxAmount?: number;
  discountAmount?: number;
  tipAmount?: number;
  invoiceNumber?: string;
  items?: ParsedReceiptItem[];
  notes?: string;
  confidence?: string;
}

interface ScanReceiptModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAddExpense?: (initialData?: ExpenseInitialData) => void;
  onExpenseAdded?: (expenseId: string) => void;
}

// Generate demo receipt base64 images for quick 1-click testing
function createDemoReceiptDataUrl(type: 'cafe' | 'grocery' | 'fuel'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 800);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 580, 780);

  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';

  if (type === 'cafe') {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('BLUE TOKAI COFFEE ROASTERS', 300, 70);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('124 Indiranagar 100ft Road, Bengaluru', 300, 100);
    ctx.fillText('GSTIN: 29AABCT1234F1Z8 | Bill #BT-88942', 300, 125);
    ctx.fillText(`Date: ${todayISO()} 10:45 AM`, 300, 150);

    ctx.strokeStyle = '#d1d5db';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, 175);
    ctx.lineTo(570, 175);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('ITEM', 40, 210);
    ctx.fillText('QTY', 360, 210);
    ctx.fillText('TOTAL', 490, 210);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#374151';
    ctx.fillText('Iced Sea Salt Mocha', 40, 250);
    ctx.fillText('1', 370, 250);
    ctx.fillText('₹ 280.00', 490, 250);

    ctx.fillText('Almond Croissant', 40, 290);
    ctx.fillText('1', 370, 290);
    ctx.fillText('₹ 220.00', 490, 290);

    ctx.fillText('Pour Over (Vienna Roast)', 40, 330);
    ctx.fillText('1', 370, 330);
    ctx.fillText('₹ 250.00', 490, 330);

    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, 380);
    ctx.lineTo(570, 380);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillText('Subtotal:', 40, 420);
    ctx.fillText('₹ 750.00', 490, 420);
    ctx.fillText('CGST + SGST (5%):', 40, 450);
    ctx.fillText('₹ 37.50', 490, 450);
    ctx.fillText('Service Charge (5%):', 40, 480);
    ctx.fillText('₹ 37.50', 490, 480);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('GRAND TOTAL:', 40, 540);
    ctx.fillText('₹ 825.00', 470, 540);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Payment: UPI / Google Pay', 40, 600);
    ctx.textAlign = 'center';
    ctx.fillText('Thank you for visiting! Have a wonderful day!', 300, 710);
  } else if (type === 'grocery') {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('NATURES BASKET SUPERMARKET', 300, 70);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Store #14, Koramangala 5th Block', 300, 100);
    ctx.fillText('Tax Invoice #NB-44210', 300, 125);
    ctx.fillText(`Date: ${todayISO()} 04:15 PM`, 300, 150);

    ctx.strokeStyle = '#d1d5db';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, 175);
    ctx.lineTo(570, 175);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('ITEM', 40, 210);
    ctx.fillText('QTY', 360, 210);
    ctx.fillText('TOTAL', 490, 210);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#374151';
    ctx.fillText('Organic Milk 1L', 40, 250);
    ctx.fillText('2', 370, 250);
    ctx.fillText('₹ 140.00', 490, 250);

    ctx.fillText('Greek Yogurt (Blueberry)', 40, 290);
    ctx.fillText('2', 370, 290);
    ctx.fillText('₹ 180.00', 490, 290);

    ctx.fillText('Whole Wheat Sourdough Bread', 40, 330);
    ctx.fillText('1', 370, 330);
    ctx.fillText('₹ 160.00', 490, 330);

    ctx.fillText('Fresh Avocados (Pack of 2)', 40, 370);
    ctx.fillText('1', 370, 370);
    ctx.fillText('₹ 220.00', 490, 370);

    ctx.fillText('Sparkling Apple Juice', 40, 410);
    ctx.fillText('1', 370, 410);
    ctx.fillText('₹ 190.00', 490, 410);

    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, 450);
    ctx.lineTo(570, 450);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillText('Subtotal:', 40, 490);
    ctx.fillText('₹ 890.00', 490, 490);
    ctx.fillText('Member Discount (10%):', 40, 520);
    ctx.fillText('- ₹ 89.00', 490, 520);
    ctx.fillText('Taxes (5% GST):', 40, 550);
    ctx.fillText('₹ 40.00', 490, 550);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('TOTAL DUE:', 40, 610);
    ctx.fillText('₹ 841.00', 470, 610);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Payment: Credit Card (Visa Ending *4412)', 40, 660);
    ctx.textAlign = 'center';
    ctx.fillText('Thank you for shopping with us!', 300, 720);
  } else {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('SHELL AUTO FUEL STATION', 300, 70);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Outer Ring Road, Marathahalli', 300, 100);
    ctx.fillText('Invoice #SH-992144', 300, 125);
    ctx.fillText(`Date: ${todayISO()} 08:30 AM`, 300, 150);

    ctx.strokeStyle = '#d1d5db';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, 175);
    ctx.lineTo(570, 175);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('PRODUCT', 40, 220);
    ctx.fillText('RATE/L', 340, 220);
    ctx.fillText('VOLUME', 460, 220);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#374151';
    ctx.fillText('Shell V-Power Petrol', 40, 265);
    ctx.fillText('₹ 108.50', 340, 265);
    ctx.fillText('18.43 L', 460, 265);

    ctx.fillText('Windshield Fluid 500ml', 40, 310);
    ctx.fillText('₹ 150.00', 340, 310);
    ctx.fillText('1 Unit', 460, 310);

    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, 380);
    ctx.lineTo(570, 380);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('TOTAL DUE:', 40, 440);
    ctx.fillText('₹ 2,150.00', 450, 440);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#4b5563';
    ctx.fillText('Payment: Cash', 40, 500);
    ctx.fillText('Pump No: 04 | Attendant: Ramesh', 40, 530);

    ctx.textAlign = 'center';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Drive safely and visit again!', 300, 680);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

// Compress and resize image client-side before sending to Gemini OCR
async function compressImageFile(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            base64: (event.target?.result as string) || '',
            mimeType: 'image/jpeg',
          });
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.86);
        resolve({
          base64: compressedDataUrl,
          mimeType: 'image/jpeg',
        });
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export default function ScanReceiptModal({
  open,
  onClose,
  onOpenAddExpense,
  onExpenseAdded,
}: ScanReceiptModalProps) {
  const { db, addExpense, showToast } = useStore();
  const currency = db.settings?.currency || 'INR';
  const sym = currencySymbol(currency);

  const [step, setStep] = useState<'camera' | 'files' | 'scanning' | 'review'>('camera');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [scanningMessage, setScanningMessage] = useState('Analyzing receipt with Gemini OCR...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showImageZoom, setShowImageZoom] = useState(false);

  // Parsed Receipt Data State for Review
  const [receiptData, setReceiptData] = useState<ParsedReceiptData | null>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedAmount, setEditedAmount] = useState<number | string>('');
  const [editedCategory, setEditedCategory] = useState('Food & Dining');
  const [editedWalletId, setEditedWalletId] = useState('');
  const [editedDate, setEditedDate] = useState(todayISO());
  const [editedNotes, setEditedNotes] = useState('');
  const [itemsList, setItemsList] = useState<ParsedReceiptItem[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const toggleCameraFacing = useCallback(() => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  // Perform Gemini Multimodal OCR Extraction via server-side endpoint
  const processReceiptImage = async (imageBase64: string, mimeType: string) => {
    setImagePreview(imageBase64);
    setStep('scanning');
    setErrorMessage(null);

    const messages = [
      'Scanning receipt with Gemini OCR...',
      'Locating merchant & line items...',
      'Calculating taxes, discounts & totals...',
      'Matching ledger categories & accounts...',
    ];

    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setScanningMessage(messages[msgIdx]);
    }, 900);

    try {
      const categories = (db.settings?.categories || []).map((c) => c.name);
      const wallets = (db.wallets || []).map((w) => w.name);
      const friends = (db.friends || []).map((f) => f.name);

      const response = await fetch('/api/ocr/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          context: {
            categories,
            wallets,
            friends,
            currency,
          },
        }),
      });

      clearInterval(interval);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `OCR Service error (${response.status})`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Could not extract receipt data');
      }

      const parsed: ParsedReceiptData = result.data;
      setReceiptData(parsed);

      setEditedDescription(parsed.description || parsed.merchantName || 'Receipt Expense');
      setEditedAmount(parsed.totalAmount || 0);
      setEditedDate(parsed.date || todayISO());

      const matchedCat = db.settings?.categories?.find(
        (c) => c.name.toLowerCase() === (parsed.category || '').toLowerCase()
      );
      setEditedCategory(matchedCat ? matchedCat.name : parsed.category || db.settings?.defaultCategory || 'Food & Dining');

      const matchedWallet = db.wallets?.find(
        (w) => w.name.toLowerCase() === (parsed.suggestedWallet || '').toLowerCase()
      );
      setEditedWalletId(
        matchedWallet ? matchedWallet.id : db.settings?.defaultWalletId || db.wallets?.[0]?.id || ''
      );

      const items = (parsed.items || []).map((item) => ({
        ...item,
        selected: true,
      }));
      setItemsList(items);

      let noteContent = parsed.notes || '';
      if (parsed.invoiceNumber) {
        noteContent = `Bill #${parsed.invoiceNumber}${noteContent ? ` • ${noteContent}` : ''}`;
      }
      setEditedNotes(noteContent);

      setStep('review');
    } catch (err: unknown) {
      clearInterval(interval);
      console.error('Receipt scanning error:', err);
      const errText = err instanceof Error ? err.message : 'Failed to scan receipt. You can try again or enter details manually.';
      setErrorMessage(errText);
      setStep('camera');
    }
  };

  // Check camera availability
  useEffect(() => {
    if (!open) return;
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        })
        .catch(() => {});
    }
  }, [open]);

  // Manage camera media stream based on modal open state and active step
  useEffect(() => {
    if (!open || step !== 'camera') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    const initCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported in this browser.');
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsCameraActive(true);
      } catch (err: unknown) {
        if (!isMounted) return;
        setIsCameraActive(false);
        const isDenied = err instanceof Error && (err.message.includes('Permission denied') || err.name === 'NotAllowedError');
        setErrorMessage(
          isDenied
            ? 'Camera permission was denied. You can choose a receipt file from your device.'
            : 'Unable to open camera. Please select a file from your device.'
        );
        setStep('files');
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [open, step, cameraFacing]);

  const capturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      stopCamera();
      processReceiptImage(dataUrl, 'image/jpeg');
    } catch (err: unknown) {
      console.error('Failed to capture photo:', err);
      showToast('Error capturing photo');
    }
  };

  const handleImageFileSelected = async (file: File) => {
    stopCamera();
    try {
      const { base64, mimeType } = await compressImageFile(file);
      processReceiptImage(base64, mimeType);
    } catch (err: unknown) {
      console.error('File load error:', err);
      setErrorMessage('Failed to read image file. Please try another image.');
    }
  };

  const handleDemoReceiptClick = (type: 'cafe' | 'grocery' | 'fuel') => {
    stopCamera();
    const demoUrl = createDemoReceiptDataUrl(type);
    processReceiptImage(demoUrl, 'image/jpeg');
  };

  const processReceiptImageRef = useRef(processReceiptImage);
  useEffect(() => {
    processReceiptImageRef.current = processReceiptImage;
  });

  // Clipboard paste listener
  useEffect(() => {
    if (!open) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            stopCamera();
            try {
              const { base64, mimeType } = await compressImageFile(file);
              processReceiptImageRef.current(base64, mimeType);
            } catch (err: unknown) {
              console.error('File load error:', err);
              setErrorMessage('Failed to read image file.');
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, stopCamera]);

  const handleToggleItem = (index: number) => {
    setItemsList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      const newTotal = updated.reduce((sum, it) => (it.selected ? sum + (Number(it.price) || 0) : sum), 0);
      if (newTotal > 0) {
        const tax = receiptData?.taxAmount || 0;
        const discount = receiptData?.discountAmount || 0;
        const tip = receiptData?.tipAmount || 0;
        setEditedAmount(Math.max(0, Math.round((newTotal + tax + tip - discount) * 100) / 100));
      }
      return updated;
    });
  };

  const handleSaveExpense = () => {
    const amt = Number(editedAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid expense amount');
      return;
    }

    const selectedItems = itemsList.filter((it) => it.selected);
    let fullNotes = editedNotes;
    if (selectedItems.length > 0) {
      const itemLines = selectedItems
        .map((it) => `• ${it.name} ${it.quantity && it.quantity > 1 ? `(x${it.quantity})` : ''} - ${sym}${it.price}`)
        .join('\n');
      fullNotes = fullNotes ? `${fullNotes}\n\nItems:\n${itemLines}` : `Items:\n${itemLines}`;
    }

    const newExpenseId = uid();
    addExpense({
      description: editedDescription.trim() || receiptData?.merchantName || 'Receipt Expense',
      amount: amt,
      category: editedCategory,
      walletId: editedWalletId || db.wallets?.[0]?.id || '',
      date: editedDate || todayISO(),
      type: 'personal',
      flow: 'out',
      status: 'paid',
      settled: true,
      friendId: null,
      notes: fullNotes,
    });

    showToast(`Saved expense: ${editedDescription || 'Receipt'} (${sym}${amt})`);
    if (onExpenseAdded) {
      onExpenseAdded(newExpenseId);
    }
    stopCamera();
    onClose();
  };

  const handleOpenInFullEditor = () => {
    const amt = Number(editedAmount) || receiptData?.totalAmount || 0;
    const selectedItems = itemsList.filter((it) => it.selected);
    let fullNotes = editedNotes;
    if (selectedItems.length > 0) {
      const itemLines = selectedItems
        .map((it) => `• ${it.name} ${it.quantity && it.quantity > 1 ? `(x${it.quantity})` : ''} - ${sym}${it.price}`)
        .join('\n');
      fullNotes = fullNotes ? `${fullNotes}\n\nItems:\n${itemLines}` : `Items:\n${itemLines}`;
    }

    const initialData: ExpenseInitialData = {
      description: editedDescription || receiptData?.merchantName || 'Receipt Expense',
      amount: amt > 0 ? amt : '',
      category: editedCategory,
      walletId: editedWalletId,
      date: editedDate,
      type: 'personal',
      flow: 'out',
      status: 'paid',
      notes: fullNotes,
    };

    stopCamera();
    onClose();
    if (onOpenAddExpense) {
      onOpenAddExpense(initialData);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
      {/* Hidden File Input for Device Files Manager */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFileSelected(file);
          e.target.value = '';
        }}
      />

      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-lg max-h-[94vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0d0f12] text-white border border-white/10 shadow-2xl overflow-hidden font-sans"
        style={{ background: '#0e1116' }}
      >
        {/* Drawer Drag Indicator */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Top Cinema HUD Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isCameraActive ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/10 border-white/20 text-white/70'} border text-[11px] font-mono font-bold tracking-wider uppercase`}>
              <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isCameraActive ? 'REC • AI SCAN' : 'STANDBY • OCR'}</span>
            </div>

            {step !== 'review' && step !== 'scanning' && (
              <div className="hidden xs:flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/10 text-xs">
                <button
                  onClick={() => {
                    setStep('camera');
                  }}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    step === 'camera' ? 'bg-white/20 text-white shadow-xs' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Lens
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    setStep('files');
                  }}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    step === 'files' ? 'bg-white/20 text-white shadow-xs' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Files
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal / Drawer Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
              <button onClick={() => setErrorMessage(null)} className="opacity-70 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* 1. MOVIE CAMERA VIEWFINDER MODE */}
          {step === 'camera' && (
            <div className="space-y-4">
              {/* Cinematic Viewfinder Frame */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Movie HUD Corner Brackets */}
                <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <div className="text-[10px] font-mono tracking-widest text-cyan-300 font-bold bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
                      4K UHD • F/1.8 • 60FPS
                    </div>
                    <div className="w-6 h-6 border-t-2 border-r-2 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  </div>

                  {/* Center Crosshair Aim */}
                  <div className="absolute inset-0 grid place-items-center opacity-40">
                    <Crosshair size={36} strokeWidth={1} className="text-cyan-400" />
                  </div>

                  {/* Framing message & bottom brackets */}
                  <div className="flex justify-between items-end">
                    <div className="w-6 h-6 border-b-2 border-l-2 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <div className="text-[11px] font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs border border-white/10">
                      Center receipt inside frame
                    </div>
                    <div className="w-6 h-6 border-b-2 border-r-2 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  </div>
                </div>

                {/* Animated soft scan laser line */}
                <motion.div
                  animate={{ top: ['5%', '92%', '5%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(34,211,238,1)] pointer-events-none"
                />
              </div>

              {/* Cinematic Camera Control Bar */}
              <div className="flex items-center justify-between px-6 pt-1">
                {/* File Manager Option */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
                  title="Choose from File Manager / Gallery"
                >
                  <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 grid place-items-center hover:bg-white/20 transition-all">
                    <FolderOpen size={20} />
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">Files</span>
                </button>

                {/* Primary Movie Camera Shutter Button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="relative group p-1 rounded-full active:scale-95 transition-transform"
                  title="Capture Receipt Photo"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/10 group-hover:bg-white/20 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    <div className="w-12 h-12 rounded-full bg-white group-hover:scale-95 transition-transform" />
                  </div>
                </button>

                {/* Switch Front/Back Camera */}
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className={`flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors ${!hasMultipleCameras ? 'opacity-50' : ''}`}
                  title={hasMultipleCameras ? "Flip Camera" : "Switch Camera Mode"}
                >
                  <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 grid place-items-center hover:bg-white/20 transition-all">
                    <SwitchCamera size={20} />
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">Flip</span>
                </button>
              </div>

              {/* 1-Click Sample Receipts */}
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    <span>Quick test samples</span>
                  </span>
                  <span className="text-[10px] text-white/40">1-click test</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleDemoReceiptClick('cafe')}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all"
                  >
                    <span className="text-sm block">☕</span>
                    <span className="text-xs font-bold block truncate">Cafe Bill</span>
                    <span className="text-[10px] text-white/50 block truncate">₹825 • Blue Tokai</span>
                  </button>

                  <button
                    onClick={() => handleDemoReceiptClick('grocery')}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all"
                  >
                    <span className="text-sm block">🛒</span>
                    <span className="text-xs font-bold block truncate">Grocery</span>
                    <span className="text-[10px] text-white/50 block truncate">₹841 • Nature's</span>
                  </button>

                  <button
                    onClick={() => handleDemoReceiptClick('fuel')}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all"
                  >
                    <span className="text-sm block">⛽</span>
                    <span className="text-xs font-bold block truncate">Fuel Pump</span>
                    <span className="text-[10px] text-white/50 block truncate">₹2,150 • Shell</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. CHOOSE FILES FROM MANAGER MODE */}
          {step === 'files' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-white/20 hover:border-cyan-400 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white/5 hover:bg-white/10"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 grid place-items-center mx-auto mb-3 group-hover:scale-105 transition-transform text-cyan-400">
                  <FolderOpen size={26} />
                </div>
                <p className="text-sm font-bold text-white">Choose Bill from File Manager</p>
                <p className="text-xs text-white/50 mt-1">
                  Supports JPG, PNG, WEBP • Paste screenshot with Ctrl+V
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-all shadow-md inline-flex items-center gap-1.5"
                >
                  <FolderOpen size={15} />
                  <span>Browse Device Files</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setStep('camera');
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 text-white transition-all"
                >
                  <Camera size={16} />
                  <span>Switch to Movie Camera Viewfinder</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. SCANNING OCR PROGRESS */}
          {step === 'scanning' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
              <div className="relative w-48 h-60 rounded-2xl overflow-hidden border-2 border-cyan-400/50 bg-black shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Scanning preview"
                    className="w-full h-full object-cover opacity-70 filter contrast-125"
                  />
                )}
                <motion.div
                  animate={{ top: ['0%', '95%', '0%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,1)]"
                />
                <div className="absolute bottom-2 inset-x-2 py-1 bg-black/80 backdrop-blur-xs rounded text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-widest text-center">
                  SCANNING RECEIPT
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-white font-sans">
                  <Sparkles size={16} className="text-amber-400 animate-spin" />
                  <span>{scanningMessage}</span>
                </div>
                <p className="text-xs text-white/50 max-w-xs mx-auto">
                  Extracting merchant, items, taxes, and exact totals
                </p>
              </div>
            </div>
          )}

          {/* 4. REVIEW & LOG EXPENSE */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Receipt Summary Card */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {imagePreview && (
                    <div
                      onClick={() => setShowImageZoom(true)}
                      className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/20 shrink-0 cursor-pointer group"
                      title="Tap to zoom receipt"
                    >
                      <img src={imagePreview} alt="Receipt" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn size={16} />
                      </div>
                    </div>
                  )}

                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/50 block">
                      Vendor / Merchant
                    </span>
                    <input
                      type="text"
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      placeholder="Merchant name"
                      className="w-full font-bold text-base text-white bg-transparent border-b border-transparent hover:border-white/30 focus:border-cyan-400 outline-none transition-colors"
                    />
                    {receiptData?.invoiceNumber && (
                      <span className="text-[11px] text-white/50 font-mono">
                        Invoice #{receiptData.invoiceNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/50 block">
                    Total Amount
                  </span>
                  <div className="flex items-center sm:justify-end gap-1">
                    <span className="text-lg font-bold text-white/60">{sym}</span>
                    <input
                      type="number"
                      step="any"
                      value={editedAmount}
                      onChange={(e) => setEditedAmount(e.target.value)}
                      className="w-28 font-bold text-2xl text-white text-left sm:text-right bg-transparent border-b border-dashed border-white/30 focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Date</span>
                  </label>
                  <input
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 flex items-center gap-1">
                    <Tag size={12} />
                    <span>Category</span>
                  </label>
                  <select
                    value={editedCategory}
                    onChange={(e) => setEditedCategory(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-[#1a1d24] border border-white/10 text-white outline-none focus:border-cyan-400"
                  >
                    {(db.settings?.categories || []).map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/60 mb-1 flex items-center gap-1">
                    <WalletIcon size={12} />
                    <span>Account</span>
                  </label>
                  <select
                    value={editedWalletId}
                    onChange={(e) => setEditedWalletId(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-[#1a1d24] border border-white/10 text-white outline-none focus:border-cyan-400"
                  >
                    {(db.wallets || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Itemized Line Items */}
              {itemsList.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-white/60" />
                      <span>Itemized Breakdown ({itemsList.length})</span>
                    </span>
                    <span className="text-[11px] text-white/50 font-normal">
                      Select items to include
                    </span>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-2">
                    {itemsList.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleItem(idx)}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          item.selected
                            ? 'bg-white/10 text-white border border-white/10'
                            : 'opacity-40 line-through text-white/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`w-4 h-4 rounded grid place-items-center text-[10px] ${
                              item.selected ? 'bg-emerald-500 text-white' : 'border border-white/30'
                            }`}
                          >
                            {item.selected && <Check size={11} strokeWidth={3} />}
                          </div>
                          <span className="font-medium truncate">{item.name}</span>
                          {item.quantity && item.quantity > 1 && (
                            <span className="text-[10px] text-white/50 font-mono">
                              x{item.quantity}
                            </span>
                          )}
                        </div>
                        <span className="font-bold tabular-nums ml-2">
                          {sym}{item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-white/60 mb-1 block">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Receipt notes..."
                  className="w-full text-xs font-medium p-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Drawer Bottom Action Bar */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
          {step === 'review' ? (
            <>
              <button
                onClick={() => {
                  setStep('camera');
                  setImagePreview(null);
                  setReceiptData(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors"
              >
                <RotateCcw size={14} />
                <span>Retake</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenInFullEditor}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
                >
                  Open in Editor
                </button>
                <button
                  onClick={handleSaveExpense}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-white/90 shadow-lg transition-all active:scale-95"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>Log Expense ({sym}{editedAmount || 0})</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-[11px] text-white/50 font-medium">
                Movie Camera HUD • AI Auto-Scan
              </span>
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Full Image Zoom Overlay */}
        {showImageZoom && imagePreview && (
          <div
            onClick={() => setShowImageZoom(false)}
            className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-2xl max-h-[90vh]">
              <img
                src={imagePreview}
                alt="Receipt Full View"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
              <button
                onClick={() => setShowImageZoom(false)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/20 text-white grid place-items-center"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
