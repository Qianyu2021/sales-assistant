import { titleCase } from "../lib/format.js";

function inferCompanyFromEmail(email) {
  const domain = email.split("@")[1] || "";
  const root = domain.split(".")[0] || "";
  return root ? titleCase(root.replace(/[-_]/g, " ")) : "";
}

export function normalizeLead(input) {
  const lead = {
    firstName: (input.firstName || "").trim(),
    lastName: (input.lastName || "").trim(),
    senderNameSource: (input.senderNameSource || "").trim(),
    email: (input.email || "").trim().toLowerCase(),
    company: (input.company || "").trim(),
    propertyName: (input.propertyName || input.apartmentName || "").trim(),
    apartmentName: (input.apartmentName || input.propertyName || "").trim(),
    operatorName: (input.operatorName || "").trim(),
    senderCompany: (input.senderCompany || "").trim(),
    operatorAddress: (input.operatorAddress || "").trim(),
    senderCompanyAddress: (input.senderCompanyAddress || "").trim(),
    address: (input.address || "").trim(),
    city: (input.city || "").trim(),
    state: (input.state || "").trim().toUpperCase(),
    rawInput: (input.rawInput || input.raw_input || "").trim(),
    source: input.source || "manual",
  };

  if (!lead.company && lead.email) {
    lead.company = inferCompanyFromEmail(lead.email);
  }

  if (lead.operatorName) {
    lead.company = lead.operatorName;
  } else if (!lead.company && lead.propertyName) {
    lead.company = lead.propertyName;
  }

  if (!lead.firstName && lead.email && lead.source !== "gmail") {
    lead.firstName = titleCase(lead.email.split("@")[0].split(/[._-]/)[0] || "Lead");
  }

  return lead;
}
