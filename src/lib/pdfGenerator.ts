import { pdf } from '@react-pdf/renderer';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import React from 'react';

/**
 * Download a single PDF directly
 */
export async function downloadSinglePDF(
  documentElement: React.ReactElement,
  filename: string
): Promise<void> {
  const blob = await pdf(documentElement).toBlob();
  saveAs(blob, filename);
}

/**
 * Generate a Blob URL for previewing in iframe / modal
 */
export async function getPDFBlobUrl(
  documentElement: React.ReactElement
): Promise<string> {
  const blob = await pdf(documentElement).toBlob();
  return URL.createObjectURL(blob);
}

/**
 * Batch generate PDFs, add to a ZIP archive, and trigger download
 * Reports progress via onProgress callback
 */
export async function downloadBulkZIP(
  tasks: { element: React.ReactElement; filename: string }[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const total = tasks.length;

  for (let i = 0; i < total; i++) {
    if (onProgress) onProgress(i + 1, total);
    const { element, filename } = tasks[i];
    const blob = await pdf(element).toBlob();
    zip.file(filename, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipFilename);
}
