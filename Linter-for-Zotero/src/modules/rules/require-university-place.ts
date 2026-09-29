import { DataLoader } from "../../utils/data-loader";
import { defineRule } from "./rule-base";

export const RequireUniversityPlace = defineRule({
  id: "require-university-place",
  scope: "field",

  targetItemTypes: ["thesis"],
  targetItemField: "place",
  fieldMenu: {
    l10nID: "rule-require-university-place-menu-field",
  },
  async apply({ item, debug }) {
    const university = item.getField("university") as string;
    if (!university)
      return;

    const place = await getUniversityPlace(university)
      || await getUniversityPlace(university.replace(/[（(].*[)|）]/, ""));

    const currentPlace = item.getField("place") as string;
    if (!place && currentPlace)
      debug(`${university} not existed in dataset, and original place not empty, skip it.`);
    else if (place && place !== currentPlace)
      item.setField("place", place);
  },
});

async function getUniversityPlace(university: string) {
  const data = await DataLoader.load("universityPlace");
  const place = data[university];
  if (place === "" || place === null || place === undefined) {
    return "";
  }
  else {
    return place;
  }
}
