// Airtable Automation Script - UPDATE HANDLER
// Trigger: When a record is updated in "Orders" table
// Action: Run this script

// IMPORTANT: This script assumes that critical fields (Order ID, Product ID, Variant ID,
// Item ID, Customer ID, Quantity) should NEVER change. We validate against the CP Orders
// table to detect if they were changed.

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
let storedProductId = cpOrderRecord.getCellValue("Product ID");
let storedVariantId = cpOrderRecord.getCellValue("Variant ID");
let storedCustomerId = cpOrderRecord.getCellValue("Customer ID");

// Since we can't reliably check Item ID and Quantity from CP Orders alone,
// we'll skip those checks for now and focus on what we CAN validate

// CHECK FOR EDGE CASES - These fields should never change
let errors = [];

if (storedOrderNumber && storedOrderNumber.toString() !== orderNumber?.toString()) {
    errors.push(`Order Number was changed from "${storedOrderNumber}" to "${orderNumber}"`);
}

if (storedProductId && storedProductId.toString() !== productIdValue?.toString()) {
    errors.push(`Product ID was changed from "${storedProductId}" to "${productIdValue}"`);
}

if (storedVariantId && storedVariantId.toString() !== variantIdValue?.toString()) {
    errors.push(`Variant ID was changed from "${storedVariantId}" to "${variantIdValue}"`);
}

if (storedCustomerId && storedCustomerId.toString() !== customerIdValue?.toString()) {
    errors.push(`Customer ID was changed from "${storedCustomerId}" to "${customerIdValue}"`);
}

// If any immutable fields were changed, throw an error
if (errors.length > 0) {
    let errorMessage = "CRITICAL ERROR: The following immutable fields were changed, which is not allowed:\n" + errors.join("\n");
    console.error(errorMessage);
    throw new Error(errorMessage);
}

console.log(`Validation passed for Order ID: ${orderId}. Proceeding with update.`);

// Extract all other fields that CAN be updated
let createdAt = orderRecord.getCellValue("Created At");
let orderFulfillmentStatus = orderRecord.getCellValue("Order Fulfillment Status");
let orderPaymentStatus = orderRecord.getCellValue("Order Payment Status");
let orderCurrency = orderRecord.getCellValue("Order Currency");
let orderDiscount = orderRecord.getCellValue("Order Discount");
let orderSubtotal = orderRecord.getCellValue("Order Subtotal");
let orderShippingPrice = orderRecord.getCellValue("Order Shipping price");
let orderTax = orderRecord.getCellValue("Order Tax");
let orderTotal = orderRecord.getCellValue("Order Total");
let totalWeight = orderRecord.getCellValue("Total Weight");
let shippingFirstName = orderRecord.getCellValue("Shipping First Name");
let shippingLastName = orderRecord.getCellValue("Shipping Last Name");
let shippingCompanyName = orderRecord.getCellValue("Shipping Company Name");
let shippingAddress1 = orderRecord.getCellValue("Shipping Address 1");
let shippingAddress2 = orderRecord.getCellValue("Shipping Address 2");
let shippingCity = orderRecord.getCellValue("Shipping City");
let shippingProvince = orderRecord.getCellValue("Shipping Province");
let shippingPostalCode = orderRecord.getCellValue("Shipping Postal Code");
let shippingCountry = orderRecord.getCellValue("Shipping Country");
let tags = orderRecord.getCellValue("Tags");
let notes = orderRecord.getCellValue("Notes");
let lineItemProperties = orderRecord.getCellValue("Line Item Properties");
let lineItemShippingCompany = orderRecord.getCellValue("Line Item Shipping Company");
let lineItemTrackingNumber = orderRecord.getCellValue("Line Item Tracking Number");
let orderAdditionalDetails = orderRecord.getCellValue("Order Additional Details");
let channel = orderRecord.getCellValue("Channel");
let orderDeliveryStatus = orderRecord.getCellValue("Order Delivery Status");
let lineItemFulfillmentStatus = orderRecord.getCellValue("Line Item Fulfillment Status");
let orderDeliveryMethod = orderRecord.getCellValue("Order Delivery Method");
let orderDiscountCodes = orderRecord.getCellValue("Order Discount Codes");
let airtableToShopifyLastUpdate = orderRecord.getCellValue("Airtable -> Shopify last successful update");
let shopifyToAirtableLastUpdate = orderRecord.getCellValue("Shopify -> Airtable last successful update");

// Define references for Customers table
let customersTable = base.getTable("Customers");

// Find matching Customer record
let customerRecordId = null;
if (customerIdValue) {
    let customersQuery = await customersTable.selectRecordsAsync({
        fields: ["Customer ID"]
    });

    let customerRecord = customersQuery.records.find(record => {
        let customerIdField = record.getCellValue("Customer ID");
        return customerIdField && customerIdField.toString() === customerIdValue.toString();
    });

    if (customerRecord) {
        customerRecordId = customerRecord.id;
    } else {
        console.warn(`Customer not found for Customer ID: ${customerIdValue}`);
    }
}

// Update the CP Order record with new values
try {
    let updateFields = {
        "Order Fulfillment Status": orderFulfillmentStatus,
        "Order Payment Status": orderPaymentStatus,
        "Order Currency": orderCurrency,
        "Order Discount": orderDiscount,
        "Order Subtotal": orderSubtotal,
        "Order Shipping price": orderShippingPrice,
        "Order Tax": orderTax,
        "Order Total": orderTotal,
        "Total Weight": totalWeight,
        "Customer ID": customerIdValue,
        "Shipping First Name": shippingFirstName,
        "Shipping Last Name": shippingLastName,
        "Shipping Company Name": shippingCompanyName,
        "Shipping Address 1": shippingAddress1,
        "Shipping Address 2": shippingAddress2,
        "Shipping City": shippingCity,
        "Shipping Province": shippingProvince,
        "Shipping Postal Code": shippingPostalCode,
        "Shipping Country": shippingCountry,
        "Tags": tags,
        "Notes": notes,
        "Line Item Properties": lineItemProperties,
        "Line Item Shipping Company": lineItemShippingCompany,
        "Line Item Tracking Number": lineItemTrackingNumber,
        "Order Additional Details": orderAdditionalDetails,
        "Channel": channel,
        "Order Delivery Status": orderDeliveryStatus,
        "Line Item Fulfillment Status": lineItemFulfillmentStatus,
        "Order Delivery Method": orderDeliveryMethod,
        "Order Discount Codes": orderDiscountCodes,
        "Airtable -> Shopify last successful update": airtableToShopifyLastUpdate,
        "Shopify -> Airtable last successful update": shopifyToAirtableLastUpdate
    };

    // Add Customer link if found
    if (customerRecordId) {
        updateFields["Customers"] = [{ id: customerRecordId }];
    }

    await cpOrdersTable.updateRecordAsync(cpOrderRecordId, updateFields);
    console.log(`Successfully updated CP Order record ${cpOrderRecordId} for Order ID: ${orderId}`);
} catch (error) {
    console.error(`Failed to update CP Order record ${cpOrderRecordId}: ${error.message}`);
    throw error;
}

output.set("cpOrderRecordId", cpOrderRecordId);
output.set("message", `Successfully updated order ${orderId}. CP Order: ${cpOrderRecordId}`);
