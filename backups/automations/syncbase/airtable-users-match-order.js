// Airtable Automation Script - Match User to Order
// Trigger: When button is clicked in "Users" table
// Action: Run this script

// This script searches for a matching order based on the user's email,
// payment status, and specific variant IDs, then links the order to the user.

// Get the input configuration
let inputConfig = input.config();
let userRecordId = inputConfig.userRecordId;

// Define table references
let usersTable = base.getTable("Users");
let ordersTable = base.getTable("Syncbase Orders");

// Define the valid Variant IDs and their names
const VALID_VARIANTS = {
    "51356483191077": "Transport Included",
    "51356483223845": "Without Transport"
};

// Query the Users table to get the full record
let userRecord = await usersTable.selectRecordAsync(userRecordId);

// Validate that the record was found
if (!userRecord) {
    throw new Error(`User record not found with ID: ${userRecordId}`);
}

// Get the user's email
let userEmail = userRecord.getCellValue("Email address");

// Validate that email exists
if (!userEmail) {
    throw new Error("User has no email. Cannot search for orders.");
}

// Normalize email to lowercase for comparison
let normalizedUserEmail = userEmail.toString().toLowerCase().trim();
console.log(`Searching for orders with email: ${normalizedUserEmail}`);

// Query all Orders records
let ordersQuery = await ordersTable.selectRecordsAsync({
    fields: ["Customer Email", "Order Payment Status", "Variant ID"]
});

// Filter orders that match the criteria
let matchingOrders = ordersQuery.records.filter(record => {
    let orderEmail = record.getCellValue("Customer Email");
    let paymentStatus = record.getCellValue("Order Payment Status");
    let variantId = record.getCellValue("Variant ID");

    // Check email (case-insensitive)
    if (!orderEmail) return false;
    let normalizedOrderEmail = orderEmail.toString().toLowerCase().trim();
    if (normalizedOrderEmail !== normalizedUserEmail) return false;

    // Check payment status is PAID
    if (!paymentStatus || paymentStatus.name !== "PAID") return false;

    // Check variant ID is one of the valid ones
    if (!variantId) return false;
    let variantIdStr = variantId.toString();
    if (!VALID_VARIANTS[variantIdStr]) return false;

    return true;
});

console.log(`Found ${matchingOrders.length} matching order(s)`);

// Validate that exactly one order was found
if (matchingOrders.length === 0) {
    console.log(`No matching orders found for email ${normalizedUserEmail} with payment status PAID and valid variant ID.`);
    output.set("message", `No matching orders found for ${normalizedUserEmail}`);
} else if (matchingOrders.length > 1) {
    let orderIds = matchingOrders.map(order => order.id).join(", ");
    throw new Error(`Multiple matching orders found (${matchingOrders.length}). This is not allowed. Order IDs: ${orderIds}`);
} else {
    // Get the single matching order
    let matchingOrder = matchingOrders[0];
    let matchingOrderId = matchingOrder.id;
    let variantId = matchingOrder.getCellValue("Variant ID");
    let variantName = VALID_VARIANTS[variantId.toString()];

    console.log(`Found single matching order: ${matchingOrderId}`);
    console.log(`Variant ID: ${variantId}`);
    console.log(`Variant Name: ${variantName}`);

    // Update the User record with the order link and variant name
    try {
        await usersTable.updateRecordAsync(userRecordId, {
            "Syncbase Orders": [{ id: matchingOrderId }],
            "Variant": {name: variantName}
        });
        console.log(`Successfully linked Order ${matchingOrderId} to User ${userRecordId}`);
        console.log(`Set Variant field to: ${variantName}`);
    } catch (error) {
        console.error(`Failed to update User ${userRecordId}: ${error.message}`);
        throw error;
    }

    output.set("userRecordId", userRecordId);
    output.set("orderRecordId", matchingOrderId);
    output.set("variantName", variantName);
    output.set("message", `Successfully matched and linked order ${matchingOrderId} (${variantName}) to user ${userRecordId}`);
}
