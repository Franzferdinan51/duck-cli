/**
 * 🦆 Duck Agent - QR Code CLI Command
 * openclaw qr [--token <token>] [--gateway <url>] [--save <path>]
 * Generate QR codes for OpenClaw pairing
 */

import { Command } from 'commander';
import { generateQRCode, generatePairingQR, printPairingQR } from '../pairing/qr-generator.js';

export function createQRCommand(): Command {
  const cmd = new Command('qr')
    .description('Generate pairing QR codes for OpenClaw companion apps');

  cmd
    .option('-t, --token <token>', 'Pairing token from "duck devices token"')
    .option('-g, --gateway <url>', 'Gateway URL (default: ws://localhost:18789)', 'ws://localhost:18789')
    .option('-d, --device <deviceId>', 'Device ID for the pairing QR')
    .option('-s, --save <path>', 'Save QR as SVG to path')
    .option('--size <pixels>', 'QR code size in pixels (for SVG)', '256')
    .option('--fg <color>', 'Foreground color (hex or CSS color)', '#000000')
    .option('--bg <color>', 'Background color (hex or CSS color)', '#FFFFFF')
    .option('--format <format>', 'Output format: terminal, svg, ascii', 'terminal')
    .option('--data <text>', 'Encode arbitrary text/URL in QR (advanced)')
    .action(async (options) => {
      const { token, gateway, device, save, size, fg, bg, format, data } = options;

      if (data) {
        // Encode arbitrary data
        const result = await generateQRCode({
          data,
          size: parseInt(size) || 256,
          fgColor: fg,
          bgColor: bg,
          format: format || 'terminal',
          outputPath: save,
        });
        if (result.success) {
          if (result.ascii) {
            console.log('\n📱 QR Code:\n');
            console.log(result.ascii);
          }
          if (result.svg && !save) {
            console.log('\nSVG output (use --save to write to file):');
            console.log(result.svg.substring(0, 200) + '...');
          }
          if (result.path) {
            console.log(`\n✅ Saved to: ${result.path}\n`);
          }
        } else {
          console.error(`\n❌ QR generation failed: ${result.error}\n`);
          process.exit(1);
        }
        return;
      }

      // Default: generate pairing QR for gateway
      if (save && (format === 'svg' || save.endsWith('.svg'))) {
        const svgResult = await generateQRCode({
          data: token || gateway,
          size: parseInt(size) || 256,
          fgColor: fg,
          bgColor: bg,
          format: 'svg',
          outputPath: save,
        });
        if (svgResult.success && svgResult.path) {
          console.log(`\n✅ QR saved to: ${svgResult.path}\n`);
        } else {
          console.error(`\n❌ Failed to save QR: ${svgResult.error}\n`);
          process.exit(1);
        }
        return;
      }

      // Terminal output
      await printPairingQR(gateway, device);
    });

  return cmd;
}

export default createQRCommand;
