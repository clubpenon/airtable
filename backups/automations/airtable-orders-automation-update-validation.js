// Airtable Automation Script - VALIDATION ONLY
// Trigger: When a record is updated in "Orders" table
// Watch fields: Order ID, Order Number, Product ID, Variant ID, Item ID, Customer ID, Quantity
// Action: Run this script

// This script ONLY validates that critical fields haven't changed.
// It throws errors to alert you of unexpected behavior.

// Get the input configuration (the record that triggered the automation)
let inputConfig = input.config();
let orderRecordId = inputConfig.orderRecordId;

// Define table references
let ordersTable = base.getTable("Orders");
let cpOrdersTable = base.getTable("CP Orders");

// Query the Orders table to get the full current record
let orderRecord = await ordersTable.selectRecordAsync(orderRecordId);

// Validate that the record was found
if (!orderRecord) {
    throw new Error(`Order record not found with ID: ${orderRecordId}`);
}

// Extract current data from the record
let orderId = orderRecord.getCellValue("Order ID");
let orderNumber = orderRecord.getCellValue("Order Number");
let productIdValue = orderRecord.getCellValue("Product ID");
let variantIdValue = orderRecord.getCellValue("Variant ID");
let itemId = orderRecord.getCellValue("Item ID");
let customerIdValue = orderRecord.getCellValue("Customer ID");
let quantity = orderRecord.getCellValue("Quantity") || 1;

// Validate required fields
if (!orderId) {
    throw new Error("Order ID is required but was not found in the record");
}

// Find the corresponding CP Orders record to compare against
let cpOrdersQuery = await cpOrdersTable.selectRecordsAsync({
    fields: ["Order ID"]
});

let existingCpOrder = cpOrdersQuery.records.find(record => {
    let existingOrderId = record.getCellValue("Order ID");
    return existingOrderId && existingOrderId.toString() === orderId.toString();
});

if (!existingCpOrder) {
    throw new Error(`CP Order not found for Order ID: ${orderId}. This order may not have been synced yet.`);
}

let cpOrderRecordId = existingCpOrder.id;
console.log(`Found CP Order record ${cpOrderRecordId} for Order ID: ${orderId}`);

// Re-fetch the CP Order with all fields to validate immutable fields
let cpOrderRecord = await cpOrdersTable.selectRecordAsync(cpOrderRecordId);

if (!cpOrderRecord) {
    throw new Error(`Failed to fetch CP Order record ${cpOrderRecordId}`);
}

// Get the stored values from CP Orders (these are the "original" values)
let storedOrderNumber = cpOrderRecord.getCellValue("Order Number");
let storedCustomerId = cpOrderRecord.getCellValue("Customer ID");

// CHECK FOR CHANGES - These fields should NEVER change
let changedFields = [];
let unchangedFields = [];
let unknownFields = [];

// Fields we can validate (stored in CP Orders)
if (storedOrderNumber && storedOrderNumber.toString() !== orderNumber?.toString()) {
    changedFields.push(`Order Number: "${storedOrderNumber}" → "${orderNumber}"`);
} else if (storedOrderNumber) {
    unchangedFields.push("Order Number");
}

if (storedCustomerId && storedCustomerId.toString() !== customerIdValue?.toString()) {
    changedFields.push(`Customer ID: "${storedCustomerId}" → "${customerIdValue}"`);
} else if (storedCustomerId) {
    unchangedFields.push("Customer ID");
}

// Fields we CANNOT validate (not stored in CP Orders, only in CP OrderItems)
// These are listed as "unknown" since we can't determine if they changed
unknownFields.push("Product ID");
unknownFields.push("Variant ID");
unknownFields.push("Item ID");
unknownFields.push("Quantity");

// Build error message
let errorMessage = "CRITICAL ERROR: One or more immutable fields were updated in the Orders table.\n\n";

errorMessage += "Fields that HAVE changed (NOT ALLOWED):\n";
if (changedFields.length > 0) {
    changedFields.forEach(field => {
        errorMessage += `  ✗ ${field}\n`;
    });
} else {
    errorMessage += "  (none detected)\n";
}

errorMessage += "\nFields that have NOT changed:\n";
if (unchangedFields.length > 0) {
    unchangedFields.forEach(field => {
        errorMessage += `  ✓ ${field}\n`;
    });
} else {
    errorMessage += "  (none checked)\n";
}

errorMessage += "\nFields that CANNOT be validated (stored in CP OrderItems, not CP Orders):\n";
unknownFields.forEach(field => {
    errorMessage += `  ? ${field}\n`;
});

errorMessage += "\nThis automation was triggered because one or more of these immutable fields was updated.";
errorMessage += "\nPlease review the Orders record and revert any changes to immutable fields.";

// Always throw error since this automation was triggered
// (meaning one or more immutable fields were updated)
console.error(errorMessage);
throw new Error(errorMessage);
