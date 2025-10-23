import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchQuota = createAsyncThunk('quota/fetchQuota', async () => {
  const resp = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
  if (!resp.ok) throw new Error('Failed to fetch quota');
  const data = await resp.json();
  // Normalize shape
  return {
    limit: data?.limit ?? null,
    remaining: typeof data?.remaining === 'number' ? data.remaining : null,
    raw: data || null,
  };
});

const quotaSlice = createSlice({
  name: 'quota',
  initialState: {
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    limit: null,
    remaining: null,
    error: null,
    lastUpdated: null,
  },
  reducers: {
    setQuota(state, action) {
      const { limit = null, remaining = null } = action.payload || {};
      state.limit = limit;
      state.remaining = typeof remaining === 'number' ? Math.max(0, remaining) : remaining;
      state.lastUpdated = Date.now();
      state.status = 'succeeded';
      state.error = null;
    },
    decrement(state, action) {
      const by = typeof action.payload === 'number' ? action.payload : 1;
      if (typeof state.remaining === 'number') {
        state.remaining = Math.max(0, state.remaining - by);
        state.lastUpdated = Date.now();
      }
    },
    reset(state) {
      state.status = 'idle';
      state.limit = null;
      state.remaining = null;
      state.error = null;
      state.lastUpdated = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuota.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchQuota.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.limit = action.payload.limit;
        state.remaining = typeof action.payload.remaining === 'number' ? Math.max(0, action.payload.remaining) : action.payload.remaining;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(fetchQuota.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message || 'Failed to fetch quota';
      });
  }
});

export const { setQuota, decrement, reset } = quotaSlice.actions;
export default quotaSlice.reducer;
