import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..'); // Resolves to /server/
const DEV_DATA_DIR = path.join(SERVER_DIR, 'dev-data');
const UPLOADS_DIR = path.join(DEV_DATA_DIR, 'uploads');
const SKETCHES_DIR = path.join(UPLOADS_DIR, 'sketches');
const USERS_FILE = path.join(DEV_DATA_DIR, 'users.json');
const IMAGES_FILE = path.join(DEV_DATA_DIR, 'images.json');
const LIKES_FILE = path.join(DEV_DATA_DIR, 'likes.json');
const SKETCHES_FILE = path.join(DEV_DATA_DIR, 'sketches.json');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DEV_DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(SKETCHES_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating directories:', err);
  }
}

// Map role_id to canonical role info (single-role model)
function getRoleInfo(role_id) {
  return Number(role_id) === 1
    ? { role_id: 1, role_name: 'superuser' }
    : { role_id: 2, role_name: 'public' };
}

// Read JSON file
async function readJsonFile(filePath) {
  try {
    console.log('[Dev DB] Reading file:', filePath);
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    console.log('[Dev DB] File contents:', parsed);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[Dev DB] File not found:', filePath);
      return null;
    }
    console.error('[Dev DB] Error reading file:', error);
    throw error;
  }
}

// Write JSON file
async function writeJsonFile(filePath, data) {
  console.log('[Dev DB] Writing to file:', filePath);
  console.log('[Dev DB] Data to write:', data);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Mock database functions
export async function query(text, params) {
  await ensureDirectories();
  console.log('\n[Dev DB] Executing query:', { text, params });

  // Handle subscription plan queries
  if (text.toLowerCase().includes('select subscription_plan')) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const [userId] = params;
    const user = data.users.find(u => u.id === userId);
    return { rows: user ? [{ subscription_plan: user.subscription_plan || 'free' }] : [] };
  }

  // Handle generation count queries
  if (text.toLowerCase().includes('select count(*) from images where user_id')) {
    const [userId, startDate] = params;
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    const count = data.images.filter(img => 
      img.user_id === userId && 
      new Date(img.created_at) >= new Date(startDate)
    ).length;
    return { rows: [{ count }] };
  }

  // Handle public gallery query
  if (text.toLowerCase().includes('with like_counts as')) {
    console.log('[Dev DB] Handling public gallery query');
    const imagesData = await readJsonFile(IMAGES_FILE) || { images: [] };
    const likesData = await readJsonFile(LIKES_FILE) || { likes: [] };
  
    // Get like counts for each image
    const likeCounts = {};
    likesData.likes.forEach(like => {
      likeCounts[like.image_id] = (likeCounts[like.image_id] || 0) + 1;
    });
  
    // Filter public images and add like counts
    const publicImages = imagesData.images
      .filter(img => !img.is_private)
      .map(img => ({
        ...img,
        like_count: parseInt(likeCounts[img.id] || '0', 10)
      }))
      .sort((a, b) => {
        const likeDiff = (likeCounts[b.id] || 0) - (likeCounts[a.id] || 0);
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, 10);
  
    console.log('[Dev DB] Found public images:', publicImages.length);
    return { rows: publicImages };
  }

  // Handle shared image query
  if (text.toLowerCase().includes('select * from images where id = $1 and not is_private')) {
    console.log('[Dev DB] Looking for shared image');
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    const [imageId] = params;
    const image = data.images.find(img => 
      img.id === imageId && !img.is_private
    );
    console.log('[Dev DB] Found shared image:', image ? 'yes' : 'no');
    return { rows: image ? [image] : [] };
  }

  // Handle likes queries
  if (text.toLowerCase().includes('insert into likes')) {
    const [userId, imageId] = params;
    const data = await readJsonFile(LIKES_FILE) || { likes: [] };
    
    // Check for existing like
    const existingLike = data.likes.find(
      like => like.user_id === userId && like.image_id === imageId
    );
    
    if (!existingLike) {
      const newLike = {
        id: Date.now().toString(),
        user_id: userId,
        image_id: imageId,
        created_at: new Date().toISOString()
      };
      data.likes.push(newLike);
      await writeJsonFile(LIKES_FILE, data);
    }
    
    return { rows: [] };
  }

  if (text.toLowerCase().includes('delete from likes')) {
    const [userId, imageId] = params;
    const data = await readJsonFile(LIKES_FILE) || { likes: [] };
    data.likes = data.likes.filter(
      like => !(like.user_id === userId && like.image_id === imageId)
    );
    await writeJsonFile(LIKES_FILE, data);
    return { rows: [] };
  }

  if (text.toLowerCase().includes('select image_id from likes where user_id')) {
    const [userId, imageIds] = params;
    const data = await readJsonFile(LIKES_FILE) || { likes: [] };
    const userLikes = data.likes
      .filter(like => like.user_id === userId && imageIds.includes(like.image_id))
      .map(like => ({ image_id: like.image_id }));
    return { rows: userLikes };
  }

  if (text.toLowerCase().includes('select image_id, count(*)')) {
    const [imageIds] = params;
    const data = await readJsonFile(LIKES_FILE) || { likes: [] };
    const counts = {};
    
    data.likes.forEach(like => {
      if (imageIds.includes(like.image_id)) {
        counts[like.image_id] = (counts[like.image_id] || 0) + 1;
      }
    });
    
    const rows = Object.entries(counts).map(([image_id, count]) => ({
      image_id,
      count: count.toString()
    }));
    
    return { rows };
  }

  // Users queries
  // Signup: insert new user
  if (text.toLowerCase().includes('insert into users')) {
    const [
      email,
      password,
      email_confirmed,
      confirmation_token,
      confirmation_expires,
      initial_ip,
      last_ip,
      last_user_agent,
      promo_code,
      subscription_plan
    ] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const newId = Date.now().toString();
    const createdAt = new Date().toISOString();
    const newUser = {
      id: newId,
      email: (email || '').toLowerCase(),
      password,
      // store both snake_case and camelCase for compat
      email_confirmed: !!email_confirmed,
      emailConfirmed: !!email_confirmed,
      confirmation_token: confirmation_token || null,
      confirmation_expires: confirmation_expires ? new Date(confirmation_expires).toISOString() : null,
      initial_ip: initial_ip || null,
      last_ip: last_ip || null,
      last_user_agent: last_user_agent || null,
      last_login_at: null,
      promo_code: promo_code || null,
      subscription_plan: subscription_plan || 'free',
      subscription_updated_at: createdAt,
      createdAt,
      // canonical single-role model
      role_id: 2
    };
    data.users.push(newUser);
    await writeJsonFile(USERS_FILE, data);
    return { rows: [{ id: newId, email: newUser.email, email_confirmed: newUser.email_confirmed }] };
  }

  // Signin: update last_ip, user agent, last_login_at
  if (
    text.toLowerCase().includes('update users set') &&
    text.toLowerCase().includes('last_ip') &&
    text.toLowerCase().includes('last_user_agent') &&
    text.toLowerCase().includes('last_login_at')
  ) {
    const [last_ip, last_user_agent, id] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const idx = data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      data.users[idx].last_ip = last_ip;
      data.users[idx].last_user_agent = last_user_agent;
      data.users[idx].last_login_at = new Date().toISOString();
      await writeJsonFile(USERS_FILE, data);
    }
    return { rows: [] };
  }

  // Resend confirmation: set confirmation token + expires by id
  if (
    text.toLowerCase().includes('update users set confirmation_token') &&
    text.toLowerCase().includes('where id = $3')
  ) {
    const [confirmation_token, confirmation_expires, id] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const idx = data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      data.users[idx].confirmation_token = confirmation_token;
      data.users[idx].confirmation_expires = confirmation_expires ? new Date(confirmation_expires).toISOString() : null;
      await writeJsonFile(USERS_FILE, data);
    }
    return { rows: [] };
  }

  // Confirm email: find by confirmation_token
  if (
    text.toLowerCase().includes('from users where confirmation_token = $1') &&
    text.toLowerCase().includes('select id')
  ) {
    const [token] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const u = data.users.find(x => x.confirmation_token === token);
    if (!u) return { rows: [] };
    return { rows: [{
      id: u.id,
      email: u.email,
      email_confirmed: u.email_confirmed ?? u.emailConfirmed ?? true,
      confirmation_expires: u.confirmation_expires || null
    }] };
  }

  // Confirm email: set email_confirmed true and clear token/expiry
  if (
    text.toLowerCase().includes('update users set email_confirmed = true') &&
    text.toLowerCase().includes('confirmation_token = null')
  ) {
    const [id] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const idx = data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      data.users[idx].email_confirmed = true;
      data.users[idx].emailConfirmed = true;
      data.users[idx].confirmation_token = null;
      data.users[idx].confirmation_expires = null;
      await writeJsonFile(USERS_FILE, data);
    }
    return { rows: [] };
  }

  // Forgot password: find by email returning id,email
  if (
    text.toLowerCase().includes('select id, email from users where email = $1')
  ) {
    const [email] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const u = data.users.find(x => (x.email || '').toLowerCase() === (email || '').toLowerCase());
    return { rows: u ? [{ id: u.id, email: u.email }] : [] };
  }

  // Forgot password: set reset_token and reset_expires
  if (
    text.toLowerCase().includes('update users set reset_token = $1, reset_expires = $2 where id = $3')
  ) {
    const [reset_token, reset_expires, id] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const idx = data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      data.users[idx].reset_token = reset_token;
      data.users[idx].reset_expires = reset_expires ? new Date(reset_expires).toISOString() : null;
      await writeJsonFile(USERS_FILE, data);
    }
    return { rows: [] };
  }

  // Verify reset token: select id, reset_expires by token
  if (
    text.toLowerCase().includes('select id, reset_expires from users where reset_token = $1')
  ) {
    const [token] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const u = data.users.find(x => x.reset_token === token);
    return { rows: u ? [{ id: u.id, reset_expires: u.reset_expires || null }] : [] };
  }

  // Reset password: select id, email, reset_expires by token
  if (
    text.toLowerCase().includes('select id, email, reset_expires from users where reset_token = $1')
  ) {
    const [token] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const u = data.users.find(x => x.reset_token === token);
    return { rows: u ? [{ id: u.id, email: u.email, reset_expires: u.reset_expires || null }] : [] };
  }

  // Reset password: update password and clear reset fields
  if (
    text.toLowerCase().includes('update users set password = $1, reset_token = null, reset_expires = null where id = $2')
  ) {
    const [password, id] = params;
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const idx = data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      data.users[idx].password = password;
      data.users[idx].reset_token = null;
      data.users[idx].reset_expires = null;
      await writeJsonFile(USERS_FILE, data);
    }
    return { rows: [] };
  }
  // Handle single-role join query by user id
  if (
    text.toLowerCase().includes('from users u') &&
    text.toLowerCase().includes('left join roles') &&
    text.toLowerCase().includes('where u.id = $1')
  ) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const [id] = params;
    const u = data.users.find(x => x.id === id);
    if (!u) return { rows: [] };
    const { role_id, role_name } = getRoleInfo(u.role_id ?? 2);
    return { rows: [{
      id: u.id,
      email: u.email,
      email_confirmed: u.emailConfirmed ?? u.email_confirmed ?? true,
      subscription_plan: u.subscription_plan || 'free',
      role_id,
      role_name,
      created_at: u.createdAt || new Date().toISOString(),
      last_login_at: u.last_login_at || null
    }] };
  }

  if (text.toLowerCase().includes('select * from users where email = $1')) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const [email] = params;
    const user = data.users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
    return { rows: user ? [user] : [] };
  }

  if (text.toLowerCase().includes('select id from users where email = $1')) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const [email] = params;
    const user = data.users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
    return { rows: user ? [{ id: user.id }] : [] };
  }

  if (text.toLowerCase().includes('select subscription_plan, subscription_updated_at from users where id = $1') ||
      text.toLowerCase().includes('select subscription_plan from users where id = $1')) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const [id] = params;
    const user = data.users.find(u => u.id === id);
    return { rows: user ? [{ subscription_plan: user.subscription_plan, subscription_updated_at: user.subscription_updated_at }] : [] };
  }

  if (text.toLowerCase().includes('select id, email, email_confirmed, subscription_plan, created_at, role from users where id = $1') ||
      text.toLowerCase().includes('select id, email, email_confirmed, subscription_plan, role from users where id = $1')) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    const [id] = params;
    const user = data.users.find(u => u.id === id);
    if (!user) return { rows: [] };
    const { role_id, role_name } = getRoleInfo(user.role_id ?? 2);
    return { rows: [{
      id: user.id,
      email: user.email,
      email_confirmed: user.emailConfirmed ?? user.email_confirmed ?? true,
      subscription_plan: user.subscription_plan || 'free',
      created_at: user.createdAt || new Date().toISOString(),
      role_id,
      role_name
    }] };
  }

  // Admin users list with pagination (robust match across newlines)
  if (
    text.toLowerCase().includes('from users') &&
    text.toLowerCase().includes('order by') &&
    text.toLowerCase().includes('limit') &&
    !text.toLowerCase().includes('count(*)')
  ) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    // Params may be [q, limit, offset] or [limit, offset]
    let q, limit, offset;
    if (params.length === 3) {
      [q, limit, offset] = params;
    } else {
      [limit, offset] = params;
      q = null;
    }
    const normalizedQ = (q || '').toString().toLowerCase().replace(/%/g, '');
    let users = data.users.map(u => {
      const { role_id, role_name } = getRoleInfo(u.role_id ?? 2);
      return {
        id: u.id,
        email: u.email,
        email_confirmed: u.emailConfirmed ?? u.email_confirmed ?? true,
        subscription_plan: u.subscription_plan || 'free',
        role_id,
        role_name,
        created_at: u.createdAt || new Date().toISOString(),
        last_login_at: u.last_login_at || null,
      };
    });

    if (normalizedQ) {
      users = users.filter(u => (u.email || '').toLowerCase().includes(normalizedQ));
    }

    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const slice = users.slice(offset || 0, (offset || 0) + (limit || 20));
    return { rows: slice };
  }

  if (
    text.toLowerCase().includes('select count(*)') &&
    text.toLowerCase().includes('from users')
  ) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    // Optional q param
    let q = null;
    if (params && params.length) {
      [q] = params;
    }
    const normalizedQ = (q || '').toString().toLowerCase().replace(/%/g, '');
    let count = data.users.length;
    if (normalizedQ) {
      count = data.users.filter(u => (u.email || '').toLowerCase().includes(normalizedQ)).length;
    }
    return { rows: [{ total: count }] };
  }

  if (text.toLowerCase().includes('select * from users')) {
    const data = await readJsonFile(USERS_FILE) || { users: [] };
    console.log('[Dev DB] Found users:', data.users.length);
    return { rows: data.users };
  }

  // Map role id to role name
  if (text.toLowerCase().includes('from roles') && text.toLowerCase().includes('where id = $1')) {
    const [id] = params;
    const role_name = String(id) === '1' ? 'superuser' : 'public';
    return { rows: [{ role_name }] };
  }

  if (text.toLowerCase().includes('select * from images where user_id = $1')) {
    console.log('[Dev DB] Looking for user images');
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    const userId = params[0];
    const userImages = data.images
      .filter(img => img.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    console.log('[Dev DB] Found images:', userImages.length);
    return { rows: userImages };
  }

  if (text.toLowerCase().includes('select image_url, watermarked_url from images where user_id = $1')) {
    console.log('[Dev DB] Looking for user image files');
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    const userId = params[0];
    const userImages = data.images
      .filter(img => img.user_id === userId)
      .map(img => ({
        image_url: img.image_url,
        watermarked_url: img.watermarked_url
      }));
    console.log('[Dev DB] Found image files:', userImages.length);
    return { rows: userImages };
  }

  if (text.toLowerCase().includes('delete from images where user_id = $1 and prompt = $2')) {
    console.log('[Dev DB] Deleting image by prompt');
    const [userId, prompt] = params;
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    data.images = data.images.filter(img => 
      !(img.user_id === userId && img.prompt === prompt)
    );
    await writeJsonFile(IMAGES_FILE, data);
    return { rows: [] };
  }

  if (text.toLowerCase().includes('delete from images where user_id = $1')) {
    console.log('[Dev DB] Deleting all user images');
    const userId = params[0];
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    
    // Get files to delete before filtering
    const filesToDelete = data.images
      .filter(img => img.user_id === userId)
      .flatMap(img => [
        img.image_url,
        img.watermarked_url
      ])
      .filter(Boolean);

    console.log('[Dev DB] Files to delete:', filesToDelete);

    // Delete files
    for (const filename of filesToDelete) {
      try {
        const filePath = path.join(UPLOADS_DIR, filename);
        await fs.unlink(filePath);
        console.log('[Dev DB] Deleted file:', filename);
      } catch (error) {
        console.error('[Dev DB] Error deleting file:', filename, error);
      }
    }

    // Update database
    data.images = data.images.filter(img => img.user_id !== userId);
    await writeJsonFile(IMAGES_FILE, data);
    
    return { rows: [] };
  }

  if (text.toLowerCase().includes('insert into images')) {
    console.log('[Dev DB] Inserting new image');
    const [id, userId, prompt, imageUrl, watermarkedUrl, metadata, isPrivate] = params;
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    
    const newImage = {
      id: id,
      user_id: userId,
      prompt: prompt,
      image_url: imageUrl,
      watermarked_url: watermarkedUrl,
      metadata: JSON.parse(metadata),
      is_private: isPrivate || false,
      created_at: new Date().toISOString()
    };
    
    data.images.push(newImage);
    await writeJsonFile(IMAGES_FILE, data);
    console.log('[Dev DB] Image inserted:', newImage);
    return { rows: [newImage] };
  }

  if (text.toLowerCase().includes('update images set watermarked_url')) {
    console.log('[Dev DB] Updating watermark URL');
    const [watermarkedUrl, imageId] = params;
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    const imageIndex = data.images.findIndex(img => img.id === imageId);
    
    if (imageIndex !== -1) {
      data.images[imageIndex].watermarked_url = watermarkedUrl;
      await writeJsonFile(IMAGES_FILE, data);
      console.log('[Dev DB] Updated watermark for image:', imageId);
    } else {
      console.log('[Dev DB] Image not found for watermark update:', imageId);
    }
    
    return { rows: [] };
  }

  if (text.toLowerCase().includes('update images set is_private')) {
    console.log('[Dev DB] Updating privacy setting');
    const [isPrivate, imageId, userId] = params;
    const data = await readJsonFile(IMAGES_FILE) || { images: [] };
    const imageIndex = data.images.findIndex(img => img.id === imageId && img.user_id === userId);
    
    if (imageIndex !== -1) {
      data.images[imageIndex].is_private = isPrivate;
      await writeJsonFile(IMAGES_FILE, data);
      console.log('[Dev DB] Updated privacy for image:', imageId);
    } else {
      console.log('[Dev DB] Image not found for privacy update:', imageId);
    }
    
    return { rows: [] };
  }

  console.log('[Dev DB] Unhandled query type');
  return { rows: [] };
}

// Mock Cloudinary functions
export async function uploadImage(imageUrl, userId, imageId = null) {
  console.log('[Dev DB] Mock upload image:', { imageUrl, userId, imageId });
  // In development mode, we just return the original URL
  // But in a real implementation, this would use the imageId in the URL
  return imageUrl;
}

export async function addWatermark(imageUrl, userId) {
  console.log('[Dev DB] Mock add watermark:', { imageUrl, userId });
  return imageUrl;
}

export async function uploadSketch(pngDataUrl, svgData, userId) {
  console.log('[Dev DB] Mock upload sketch:', { userId });
  await ensureDirectories();
  
  // Generate a unique ID for the sketch
  const sketchId = `sketch-${Date.now()}`;
  
  // For development, save PNG as a file
  // Remove the data URL prefix to get the base64 data
  const base64Data = pngDataUrl.replace('data:image/png;base64,', '');
  const pngFileName = `${sketchId}.png`;
  const pngFilePath = path.join(SKETCHES_DIR, pngFileName);
  
  await fs.writeFile(pngFilePath, base64Data, 'base64');
  
  // Save sketch metadata to sketches.json
  const data = await readJsonFile(SKETCHES_FILE) || { sketches: [] };
  
  const newSketch = {
    id: sketchId,
    user_id: userId,
    image_url: `/api/generate/uploads/sketches/${pngFileName}`,
    svg_data: svgData,
    created_at: new Date().toISOString()
  };
  
  data.sketches.push(newSketch);
  await writeJsonFile(SKETCHES_FILE, data);
  
  console.log('[Dev DB] Sketch saved:', sketchId);
  
  return {
    id: sketchId,
    image_url: `/api/generate/uploads/sketches/${pngFileName}`,
    svgData: svgData
  };
}

// Auth functions
export async function findUserByEmail(email) {
  console.log('[Dev DB] Finding user by email:', email);
  const data = await readJsonFile(USERS_FILE) || { users: [] };
  const user = data.users.find(user => user.email === email);
  console.log('[Dev DB] User found:', user ? 'yes' : 'no');
  return user;
}

export async function validatePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export async function createUser(email, password) {
  console.log('[Dev DB] Creating new user:', email);
  const data = await readJsonFile(USERS_FILE) || { users: [] };
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    emailConfirmed: true,
    subscription_plan: 'free',
    subscription_updated_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    role_id: 2
  };
  
  data.users.push(newUser);
  await writeJsonFile(USERS_FILE, data);
  console.log('[Dev DB] User created:', newUser.id);
  
  return newUser;
}

// Initialize dev environment
export async function initDevEnvironment() {
  console.log('[Dev DB] Initializing development environment');
  await ensureDirectories();
  
  // Create initial admin user if not exists
  const userData = await readJsonFile(USERS_FILE);
  if (!userData || !userData.users.length) {
    const hashedPassword = await bcrypt.hash('admin', 10);
    const initialData = {
      users: [
        {
          id: "admin-id-123",
          email: "admin@yastrub.com",
          password: hashedPassword,
          emailConfirmed: true,
          subscription_plan: 'business',
          subscription_updated_at: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          role_id: 1
        }
      ]
    };
    await writeJsonFile(USERS_FILE, initialData);
  } else {
    // Update existing users with subscription data if needed
    const updatedUsers = userData.users.map(user => {
      // Derive role_id from existing data: prefer existing role_id; fallback to role string
      let role_id = user.role_id;
      const cleaned = {
        ...user,
        subscription_plan: user.subscription_plan || 'free',
        subscription_updated_at: user.subscription_updated_at || new Date().toISOString(),
        role_id
      };
      return cleaned;
    });
    await writeJsonFile(USERS_FILE, { users: updatedUsers });
  }

  // Initialize empty images file if not exists
  const imagesData = await readJsonFile(IMAGES_FILE);
  if (!imagesData) {
    await writeJsonFile(IMAGES_FILE, { images: [] });
  }

  // Initialize empty likes file if not exists
  const likesData = await readJsonFile(LIKES_FILE);
  if (!likesData) {
    await writeJsonFile(LIKES_FILE, { likes: [] });
  }

  // Initialize empty sketches file if not exists
  const sketchesData = await readJsonFile(SKETCHES_FILE);
  if (!sketchesData) {
    await writeJsonFile(SKETCHES_FILE, { sketches: [] });
  }

  console.log('[Dev DB] Development environment initialized');
}
