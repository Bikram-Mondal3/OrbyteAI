import fs from 'fs/promises';
import path from 'path';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SAFE_DIR = path.resolve(__dirname, '..', 'uploads');
export const SAFE_FILE_DIR = path.resolve(process.env.PERSONAFORGE_SAFE_FILE_DIR || DEFAULT_SAFE_DIR);
export const MAX_FILE_SIZE_BYTES = Number(process.env.PERSONAFORGE_MAX_FILE_SIZE_BYTES || 1024 * 1024);

const SUPPORTED_TEXT_EXTENSIONS = new Set([
    '.txt',
    '.json',
    '.md',
    '.markdown',
    '.csv',
    '.tsv',
    '.log',
    '.yaml',
    '.yml',
    '.xml',
    '.html',
    '.css',
    '.js',
    '.ts'
]);

const SUPPORTED_ENCODINGS = new Set(['utf8', 'utf-8', 'ascii', 'latin1', 'base64']);

function normalizeEncoding(encoding = 'utf8') {
    const normalized = encoding.toLowerCase();
    return normalized === 'utf-8' ? 'utf8' : normalized;
}

export async function ensureSafeFileDirectory() {
    await fs.mkdir(SAFE_FILE_DIR, { recursive: true });
}

export function resolveSafeFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('file_path is required and must be a string.');
    }

    if (filePath.includes('\0')) {
        throw new Error('Invalid file path.');
    }

    const relativePath = path.isAbsolute(filePath)
        ? path.relative(SAFE_FILE_DIR, filePath)
        : filePath;

    const resolvedPath = path.resolve(SAFE_FILE_DIR, relativePath);
    const safeRootWithSeparator = SAFE_FILE_DIR.endsWith(path.sep)
        ? SAFE_FILE_DIR
        : `${SAFE_FILE_DIR}${path.sep}`;

    if (resolvedPath !== SAFE_FILE_DIR && !resolvedPath.startsWith(safeRootWithSeparator)) {
        throw new Error('Unsafe file path. Access is restricted to the configured safe file directory.');
    }

    return resolvedPath;
}

export async function readFileContent({ file_path, file_type, encoding = 'utf8' }) {
    const requestedEncoding = normalizeEncoding(encoding);
    const requestedPath = file_path;

    try {
        if (!SUPPORTED_ENCODINGS.has(requestedEncoding)) {
            return {
                status: 'error',
                filePath: requestedPath,
                encoding: requestedEncoding,
                message: `Unsupported encoding "${encoding}".`,
                code: 'UNSUPPORTED_ENCODING'
            };
        }

        const resolvedPath = resolveSafeFilePath(requestedPath);
        const extension = path.extname(resolvedPath).toLowerCase();
        const inferredFileType = file_type || extension.replace('.', '') || 'text';

        if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
            return {
                status: 'error',
                filePath: requestedPath,
                fileType: inferredFileType,
                encoding: requestedEncoding,
                message: `Unsupported file format "${extension || 'unknown'}". Supported text formats include txt, json, md, csv, yaml, html, css, js, and ts.`,
                code: 'UNSUPPORTED_FILE_FORMAT'
            };
        }

        let stats;
        try {
            stats = await fs.stat(resolvedPath);
        } catch (error) {
            const code = error.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_STAT_FAILED';
            return {
                status: 'error',
                filePath: requestedPath,
                fileType: inferredFileType,
                encoding: requestedEncoding,
                message: code === 'FILE_NOT_FOUND' ? 'File not found.' : 'Unable to inspect the file.',
                code
            };
        }

        if (!stats.isFile()) {
            return {
                status: 'error',
                filePath: requestedPath,
                fileType: inferredFileType,
                encoding: requestedEncoding,
                sizeBytes: stats.size,
                message: 'The requested path is not a file.',
                code: 'NOT_A_FILE'
            };
        }

        if (stats.size > MAX_FILE_SIZE_BYTES) {
            return {
                status: 'error',
                filePath: requestedPath,
                fileType: inferredFileType,
                encoding: requestedEncoding,
                sizeBytes: stats.size,
                message: `File is too large to read safely. Maximum size is ${MAX_FILE_SIZE_BYTES} bytes.`,
                code: 'FILE_TOO_LARGE'
            };
        }

        let content;
        try {
            content = await fs.readFile(resolvedPath, requestedEncoding);
        } catch (error) {
            const code = error.code === 'EACCES' || error.code === 'EPERM'
                ? 'PERMISSION_DENIED'
                : 'READ_FAILED';
            return {
                status: 'error',
                filePath: requestedPath,
                fileType: inferredFileType,
                encoding: requestedEncoding,
                sizeBytes: stats.size,
                message: code === 'PERMISSION_DENIED' ? 'Permission denied while reading the file.' : 'Unable to read the file.',
                code
            };
        }

        return {
            status: 'success',
            filePath: resolvedPath,
            requestedPath,
            fileType: inferredFileType,
            encoding: requestedEncoding,
            sizeBytes: stats.size,
            content
        };
    } catch (error) {
        return {
            status: 'error',
            filePath: requestedPath,
            encoding: requestedEncoding,
            message: error.message,
            code: 'UNSAFE_OR_INVALID_PATH'
        };
    }
}

export const readFileTool = new FunctionTool({
    name: 'read_file',
    description: 'Reads a local uploaded file from the safe uploads directory and returns its real contents for analysis or summarization.',
    parameters: z.object({
        file_path: z.string().describe('Path to a file inside the configured safe file directory.'),
        file_type: z.string().optional().describe('Optional hint for the file type, such as txt, json, md, or csv.'),
        encoding: z.string().optional().describe('Optional text encoding. Defaults to utf8.')
    }),
    execute: readFileContent
});

