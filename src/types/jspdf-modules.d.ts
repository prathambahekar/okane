declare module 'jspdf' {
  export class jsPDF {
    constructor(options?: Record<string, unknown>);
    setFontSize(size: number): void;
    setTextColor(r: number, g?: number, b?: number): void;
    text(text: string, x: number, y: number): void;
    save(filename: string): void;
  }
  export default jsPDF;
}

declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  export default function autoTable(doc: jsPDF, options: Record<string, unknown>): void;
}
