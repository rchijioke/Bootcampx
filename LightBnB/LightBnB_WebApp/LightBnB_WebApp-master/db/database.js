const properties = require("./json/properties.json");
const users = require("./json/users.json");
const { Pool } = require("pg");

const pool = new Pool({
  user: "labber",
  password: "123",
  host: "localhost",
  database: "lightbnb",
});

// the following assumes that you named your connection variable `pool`
pool.query(`SELECT title FROM properties LIMIT 10;`).then((response) => {
  console.log(response);
});

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  const query = `
  SELECT *
  FROM users
  WHERE email = $1
  
  `;
  const values = [email.toLowerCase()];

  return pool
    .query(query, values)
    .then((result) => {
      if (result.rows.length === 0) {
        return null; // User does not exist
      }
      return result.rows[0]; // Return the user object
    })
    .catch((err) => {
      console.error("Error executing query", err);
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query("SELECT * FROM users WHERE id = $1", [id])
    .then((result) => {
      return result.rows[0] || null;
    })
    .catch((err) => {
      console.error("Error executing query", err);
      throw err;
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  return pool
    .query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [user.name, user.email, user.password]
    )
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error executing query", err);
      throw err;
    });
};
/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  const query = `
    SELECT reservations.*, properties.*, AVG(property_reviews.rating) AS average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY reservations.id, properties.id
    ORDER BY reservations.start_date
    LIMIT 10;
  `;

  return pool
    .query(query, [guest_id])
    .then((result) => result.rows)
    .catch((err) => {
      console.error("Error executing query:", err);
      throw err;
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = (options, limit = 10) => {
  const queryParams = [];
  let queryString = `
    SELECT properties.*, AVG(property_reviews.rating) AS average_rating
    FROM properties
    JOIN property_reviews ON properties.id = property_reviews.property_id
  `;

  let whereClause = "";

  // Check if owner_id filter is provided
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    whereClause += ` WHERE properties.owner_id = $${queryParams.length}`;
  }

  // Check if price range filters are provided
  if (options.minimum_price_per_night && options.maximum_price_per_night) {
    if (whereClause === "") {
      whereClause += " WHERE";
    } else {
      whereClause += " AND";
    }
    queryParams.push(options.minimum_price_per_night);
    queryParams.push(options.maximum_price_per_night);
    whereClause += ` properties.cost_per_night BETWEEN $${
      queryParams.length - 1
    } AND $${queryParams.length}`;
  }

  // Check if minimum_rating filter is provided
  if (options.minimum_rating) {
    if (whereClause === "") {
      whereClause += " WHERE";
    } else {
      whereClause += " AND";
    }
    queryParams.push(options.minimum_rating);
    whereClause += ` property_reviews.rating >= $${queryParams.length}`;
  }

  // Append the WHERE clause to the main query string
  queryString += whereClause;

  // Add GROUP BY, ORDER BY, and LIMIT clauses
  queryString += `
    GROUP BY properties.id
    ORDER BY properties.cost_per_night
    LIMIT $${queryParams.length + 1};
  `;

  // Add the limit parameter to the queryParams array
  queryParams.push(limit);

  // Log the final queryString and queryParams for debugging purposes
  console.log(queryString, queryParams);

  // Execute the query and return the result
  return pool.query(queryString, queryParams).then((res) => res.rows);
};

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const queryString = `
  INSERT INTO properties (
    owner_id, title, description, thumbnail_photo_url, cover_photo_url,
    cost_per_night, street, city, province, post_code, country,
    parking_spaces, number_of_bathrooms, number_of_bedrooms
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
  )
  RETURNING *;
`;

  const values = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms,
  ];

  return pool.query(queryString, values).then((res) => res.rows[0]);
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
