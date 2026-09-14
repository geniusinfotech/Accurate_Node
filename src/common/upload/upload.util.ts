import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

type AllowedMimeTypes =
  | 'image/png'
  | 'image/jpeg'
  | 'application/pdf'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/aac'
  | 'audio/ogg'
  | 'audio/x-m4a'
  | 'audio/flac'
  | 'application/octet-stream'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel';

interface UploadOptions {
  allowedMimeTypes?: AllowedMimeTypes[];
  folderPath: string; // Full destination path
  filePrefix?: string;
  fieldName?: string; // for single()
  maxCount?: number; // for array()/fields()
}

/**
 * Express (multer) upload handler factory. Use when application uses Express adapter.
 */
export function getExpressUploadHandler(options: UploadOptions) {
  if (!fs.existsSync(options.folderPath)) {
    fs.mkdirSync(options.folderPath, { recursive: true });
  }

  const allowedMimeTypes = options.allowedMimeTypes ?? [
    'image/png',
    'image/jpeg',
    'application/pdf',
    'audio/mpeg',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/x-m4a',
    'audio/flac',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, options.folderPath),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const prefix = options.filePrefix ?? 'upload';
      cb(null, `${prefix}_${uniqueSuffix}${ext}`);
    },
  });

  function fileFilter(
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) {
    if (allowedMimeTypes.includes(file.mimetype as AllowedMimeTypes)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }

  const multerInstance = multer({ storage, fileFilter });

  if (options.maxCount && options.fieldName) {
    return multerInstance.array(options.fieldName, options.maxCount);
  } else if (options.fieldName) {
    return multerInstance.single(options.fieldName);
  }

  return multerInstance.any();
}

// Fastify multipart handler removed - application uses Express only

export default { getExpressUploadHandler };
