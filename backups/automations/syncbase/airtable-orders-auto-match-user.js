// Airtable Automation Script - Auto Match Order to User
// Trigger: When a record is created or updated in "Syncbase Orders" table
// Conditions: Order Payment Status is PAID AND Variant ID is one of the transport variants
// Action: Run this script

// This script automatically searches for a matching user based on the order's email,
// and links the user to the order if exactly one match is found.

// Get the input configuration
let inputConfig = input.config();
let orderRecordId = inputConfig.orderRecordId;

// Define table references
let ordersTable = base.getTable("Syncbase Orders");
let usersTable = base.getTable("Users");

// Define the valid Variant IDs and their names
const VALID_VARIANTS = {
    "51356483191077": "Transport Included",
    "51356483223845": "Without Transport"
};

// Query the Syncbase Orders table to get the full record
let orderRecord = await ordersTable.selectRecordAsync(orderRecordId);

// Validate that the record was found
if (!orderRecord) {
    throw new Error(`Order record not found with ID: ${orderRecordId}`);
}

// Get the order's email
let orderEmail = orderRecord.getCellValue("Customer Email");

// Validate that email exists
if (!orderEmail) {
    throw new Error("Order has no customer email. Cannot search for users.");
}

// Get variant ID and validate it's one of the valid ones
let variantId = orderRecord.getCellValue("Variant ID");
if (!variantId) {
    throw new Error("Order has no Variant ID.");
}

let variantIdStr = variantId.toString();
if (!VALID_VARIANTS[variantIdStr]) {
    throw new Error(`Variant ID ${variantIdStr} is not one of the valid transport variants.`);
}

let variantName = VALID_VARIANTS[variantIdStr];

// Normalize email to lowercase for comparison
let normalizedOrderEmail = orderEmail.toString().toLowerCase().trim();
console.log(`Searching for users with email: ${normalizedOrderEmail}`);
console.log(`Variant ID: ${variantIdStr}`);
console.log(`Variant Name: ${variantName}`);

// Query all Users records
let usersQuery = await usersTable.selectRecordsAsync({
    fields: ["Email address"]
});

// Filter users that match the email (case-insensitive)
let matchingUsers = usersQuery.records.filter(record => {
    let userEmail = record.getCellValue("Email address");

    // Check email (case-insensitive)
    if (!userEmail) return false;
    let normalizedUserEmail = userEmail.toString().toLowerCase().trim();
    if (normalizedUserEmail !== normalizedOrderEmail) return false;

    return true;
});

console.log(`Found ${matchingUsers.length} matching user(s)`);

// Validate that exactly one user was found
if (matchingUsers.length === 0) {
    throw new Error(`No matching users found for email ${normalizedOrderEmail}.`);
}

if (matchingUsers.length > 1) {
    let userIds = matchingUsers.map(user => user.id).join(", ");
    throw new Error(`Multiple matching users found (${matchingUsers.length}). This is not allowed. User IDs: ${userIds}`);
}

// Get the single matching user
let matchingUser = matchingUsers[0];
let matchingUserId = matchingUser.id;

console.log(`Found single matching user: ${matchingUserId}`);

// Update the User record with the order link and variant name
try {
    await usersTable.updateRecordAsync(matchingUserId, {
        "Syncbase Orders": [{ id: orderRecordId }],
        "Variant": {name: variantName}
    });
    console.log(`Successfully linked Order ${orderRecordId} to User ${matchingUserId}`);
    console.log(`Set Variant field to: ${variantName}`);
} catch (error) {
    console.error(`Failed to update User ${matchingUserId}: ${error.message}`);
    throw error;
}

output.set("userRecordId", matchingUserId);
output.set("orderRecordId", orderRecordId);
output.set("variantName", variantName);
output.set("message", `Successfully matched and linked order ${orderRecordId} (${variantName}) to user ${matchingUserId}`);
