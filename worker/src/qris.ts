// EMVCo / QRIS dynamic payload builder.
// Structure verified against EMVCo QR Code Specification for Payment Systems
// (merchant-presented mode) and QRIS field layout:
// - TLV stream: 2-digit tag + 2-digit length + value, ascending tag order.
// - 00 payload format indicator = 01
// - 01 point of initiation = 12 (dynamic, amount embedded)
// - 26 merchant account info (nested TLV): 00 = ID.CO.QRIS.WWW,
//   01 = NMID, 02 = merchant ID, 03 = merchant criteria (UMI/UBE)
// - 52 merchant category code, 53 currency 360 (IDR), 54 amount,
//   58 country ID, 59 merchant name (max 25), 60 merchant city (max 15),
//   62 additional data (01 = bill number / order number),
//   63 CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) over the whole payload
//   including the literal "6304" header, appended as 4 uppercase hex chars.

export interface QrisConfig {
  merchantName: string;
  merchantCity: string;
  nmid: string;
  merchantId: string;
  mcc: string;
}

export function tlv(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, "0") + value;
}

export function crc16ccittFalse(input: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildQrisPayload(cfg: QrisConfig, amount: number, orderNumber: string): string {
  const name = cfg.merchantName.slice(0, 25);
  const city = cfg.merchantCity.slice(0, 15);
  const merchantInfo =
    tlv("00", "ID.CO.QRIS.WWW") +
    tlv("01", cfg.nmid) +
    tlv("02", cfg.merchantId) +
    tlv("03", "UMI");
  const additional = tlv("01", orderNumber);
  let payload = "";
  payload += tlv("00", "01");
  payload += tlv("01", "12");
  payload += tlv("26", merchantInfo);
  payload += tlv("52", cfg.mcc);
  payload += tlv("53", "360");
  payload += tlv("54", String(Math.trunc(amount)));
  payload += tlv("58", "ID");
  payload += tlv("59", name);
  payload += tlv("60", city);
  payload += tlv("62", additional);
  payload += "6304";
  payload += crc16ccittFalse(payload);
  return payload;
}
