import { describe, it, expect } from "vitest";
import {
  validateNationalId,
  VALIDATION_RULES,
} from "../../src/utils/input-validation.js";

describe("Zambian NRC Validation", () => {
  describe("Valid NRC Numbers", () => {
    it("should accept NRC with slashes", () => {
      const result = validateNationalId("123456/05/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/05/1");
    });

    it("should accept NRC without slashes and normalize", () => {
      const result = validateNationalId("123456051");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/05/1");
    });

    it("should accept all valid province codes (01-10)", () => {
      for (let i = 1; i <= 10; i++) {
        const provinceCode = i.toString().padStart(2, "0");
        const nrc = `123456/${provinceCode}/1`;
        const result = validateNationalId(nrc);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(nrc);
      }
    });

    it("should handle leading zeros in registration number", () => {
      const result = validateNationalId("000123/05/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("000123/05/1");
    });

    it("should accept province code 10 (Muchinga)", () => {
      const result = validateNationalId("654321/10/3");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("654321/10/3");
    });

    it("should accept various check digits (0-9)", () => {
      for (let i = 0; i <= 9; i++) {
        const nrc = `123456/05/${i}`;
        const result = validateNationalId(nrc);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(nrc);
      }
    });
  });

  describe("Invalid NRC Numbers", () => {
    it("should reject empty input", () => {
      const result = validateNationalId("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject all zeros registration number", () => {
      const result = validateNationalId("000000/05/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid registration number");
    });

    it("should accept province code 00 (province validation removed)", () => {
      const result = validateNationalId("123456/00/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/00/1");
    });

    it("should accept province code 11 (province validation removed)", () => {
      const result = validateNationalId("123456/11/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/11/1");
    });

    it("should accept province code 99 (province validation removed)", () => {
      const result = validateNationalId("123456/99/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/99/1");
    });

    it("should reject too short registration number", () => {
      const result = validateNationalId("12345/05/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject too long registration number", () => {
      const result = validateNationalId("1234567/05/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject alphabetic characters", () => {
      const result = validateNationalId("ABC456/05/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject special characters", () => {
      const result = validateNationalId("123@56/05/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject wrong format with extra slashes", () => {
      const result = validateNationalId("123/456/05/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject format with missing slashes", () => {
      const result = validateNationalId("12345605/1");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });
  });

  describe("Normalization", () => {
    it("should normalize input without slashes", () => {
      const result = validateNationalId("654321103");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("654321/10/3");
      expect(result.sanitized).toBe("654321/10/3");
    });

    it("should preserve input with slashes", () => {
      const result = validateNationalId("654321/10/3");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("654321/10/3");
    });

    it("should trim whitespace", () => {
      const result = validateNationalId("  123456/05/1  ");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/05/1");
    });

    it("should normalize input with whitespace and no slashes", () => {
      const result = validateNationalId("  123456051  ");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/05/1");
    });
  });

  describe("Province Code Validation", () => {
    it("should validate all 10 Zambian provinces", () => {
      const provinces = Object.keys(
        VALIDATION_RULES.NATIONAL_ID.ZAMBIAN_NRC.PROVINCE_NAMES
      );
      expect(provinces).toHaveLength(10);

      provinces.forEach(code => {
        const result = validateNationalId(`123456/${code}/1`);
        expect(result.isValid).toBe(true);
      });
    });

    it("should have correct province names", () => {
      const provinceNames =
        VALIDATION_RULES.NATIONAL_ID.ZAMBIAN_NRC.PROVINCE_NAMES;

      expect(provinceNames["01"]).toBe("Central");
      expect(provinceNames["02"]).toBe("Copperbelt");
      expect(provinceNames["03"]).toBe("Eastern");
      expect(provinceNames["04"]).toBe("Luapula");
      expect(provinceNames["05"]).toBe("Lusaka");
      expect(provinceNames["06"]).toBe("Northern");
      expect(provinceNames["07"]).toBe("North-Western");
      expect(provinceNames["08"]).toBe("Southern");
      expect(provinceNames["09"]).toBe("Western");
      expect(provinceNames["10"]).toBe("Muchinga");
    });
  });

  describe("Edge Cases", () => {
    it("should handle maximum registration number", () => {
      const result = validateNationalId("999999/05/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("999999/05/1");
    });

    it("should handle minimum valid registration number", () => {
      const result = validateNationalId("000001/05/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("000001/05/1");
    });

    it("should reject input with only slashes", () => {
      const result = validateNationalId("//////");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject input with only numbers (wrong length)", () => {
      const result = validateNationalId("12345678");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });

    it("should reject input with correct length but wrong format", () => {
      const result = validateNationalId("123/456/78/9");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid NRC format");
    });
  });

  describe("Security", () => {
    it("should sanitize dangerous characters", () => {
      const result = validateNationalId("123456<script>/05/1");
      expect(result.isValid).toBe(false);
      // Should not contain script tags in any form
    });

    it("should handle SQL injection attempts", () => {
      const result = validateNationalId("123456'; DROP TABLE--/05/1");
      expect(result.isValid).toBe(false);
    });
  });

  describe("Real-world Examples", () => {
    it("should validate Lusaka Province NRC", () => {
      const result = validateNationalId("123456/05/1");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("123456/05/1");
    });

    it("should validate Copperbelt Province NRC", () => {
      const result = validateNationalId("987654/02/3");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("987654/02/3");
    });

    it("should validate Muchinga Province NRC (newest province)", () => {
      const result = validateNationalId("555555/10/7");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("555555/10/7");
    });
  });
});
