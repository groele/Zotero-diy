import { describe, expect, it } from "vitest";
import { correctCreatorPinyin, splitPinyin } from "./correct-creators-pinyin";

describe("splitPinyin", () => {
  it("should split simple pinyin correctly", () => {
    expect(splitPinyin("zhangsan")).toEqual(["Zhang San"]);
  });

  it("should handle input with spaces", () => {
    expect(splitPinyin("zhang san")).toEqual(["Zhang San"]);
  });

  it("should return empty for invalid input", () => {
    expect(splitPinyin("xyz")).toEqual([]);
  });
});

describe("correctCreatorPinyin", () => {
  const creatorBase: _ZoteroTypes.Item.Creator = {
    fieldMode: 0,
    firstName: "",
    lastName: "",
    creatorTypeID: 1,
  };

  it("should correct firstName if valid pinyin", () => {
    const creator = {
      ...creatorBase,
      firstName: "sanfeng",
      lastName: "zhang",
    };
    const result = correctCreatorPinyin(creator);
    expect(result.firstName).toBe("San Feng");
  });

  it("should skip if fieldMode != 0", () => {
    const creator: _ZoteroTypes.Item.Creator = {
      ...creatorBase,
      fieldMode: 1,
      firstName: "san",
      lastName: "zhang",
    };
    const result = correctCreatorPinyin(creator);
    expect(result.firstName).toBe("san");
  });

  it("should skip if lastName is not valid pinyin", () => {
    const creator = {
      ...creatorBase,
      firstName: "san",
      lastName: "xxx",
    };
    const result = correctCreatorPinyin(creator);
    expect(result.firstName).toBe("san");
  });

  it("should skip if firstName contains space", () => {
    const creator = {
      ...creatorBase,
      firstName: "san li",
      lastName: "zhang",
    };
    const result = correctCreatorPinyin(creator);
    expect(result.firstName).toBe("san li");
  });

  it("should skip if firstName contains -", () => {
    const creator = {
      ...creatorBase,
      firstName: "san-li",
      lastName: "zhang",
    };
    const result = correctCreatorPinyin(creator);
    expect(result.firstName).toBe("san-li");
  });

  it("should not split common Western first names into pinyin", () => {
    const creator1 = {
      ...creatorBase,
      firstName: "Alice",
      lastName: "wang",
    };
    expect(correctCreatorPinyin(creator1).firstName).toBe("Alice");

    const creator2 = {
      ...creatorBase,
      firstName: "Tina",
      lastName: "li",
    };
    expect(correctCreatorPinyin(creator2).firstName).toBe("Tina");

    const creator3 = {
      ...creatorBase,
      firstName: "Celine",
      lastName: "chen",
    };
    expect(correctCreatorPinyin(creator3).firstName).toBe("Celine");
  });
});
